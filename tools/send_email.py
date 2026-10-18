#!/usr/bin/env python3
"""Send a drafted job application by email over SMTP.

Two subcommands share the same message-building logic: `preview` builds the
message and prints it without touching the network (safe, pre-approved for
Claude Code to run on its own); `send` builds the same message and actually
delivers it over SMTP (deliberately left out of the permission allowlist, so
every real send prompts for a live approval - see .claude/settings.json).

Credentials come from the environment only, never a CLI flag (flags leak into
shell history and process listings): SMTP_HOST (default smtp.office365.com),
SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM_NAME (optional
display name). `send` fails loudly if SMTP_USER/SMTP_PASSWORD are unset rather
than attempting an unauthenticated connection.
"""

import argparse
import mimetypes
import os
import smtplib
import sys
from email.message import EmailMessage
from pathlib import Path


class SendError(Exception):
    """Raised when an application email cannot be built or sent."""


def _read_body(args):
    if args.body_file:
        path = Path(args.body_file)
        if not path.is_file():
            raise SendError(f"--body-file does not exist: {path}")
        return path.read_text(encoding="utf-8")
    if args.body is not None:
        return args.body
    raise SendError("one of --body or --body-file is required")


def _attach_files(message, attach_paths):
    for raw_path in attach_paths:
        path = Path(raw_path)
        if not path.is_file():
            raise SendError(f"attachment does not exist: {path}")
        data = path.read_bytes()
        if len(data) == 0:
            raise SendError(f"attachment is empty: {path}")
        mime_type, _ = mimetypes.guess_type(str(path))
        maintype, subtype = (mime_type or "application/octet-stream").split("/", 1)
        message.add_attachment(
            data, maintype=maintype, subtype=subtype, filename=path.name
        )


def build_message(args):
    if not args.to:
        raise SendError("--to is required")
    if not args.subject:
        raise SendError("--subject is required")

    from_addr = os.environ.get("SMTP_USER", "")
    from_name = os.environ.get("SMTP_FROM_NAME", "")
    from_header = f"{from_name} <{from_addr}>" if from_name and from_addr else (from_addr or "(SMTP_USER not set)")

    message = EmailMessage()
    message["To"] = args.to
    message["From"] = from_header
    message["Subject"] = args.subject
    message.set_content(_read_body(args))
    _attach_files(message, args.attach)
    return message


def render_preview(message):
    body_part = message.get_body(preferencelist=("plain",))
    body = body_part.get_content().rstrip("\n") if body_part is not None else ""
    lines = [
        f"To:      {message['To']}",
        f"From:    {message['From']}",
        f"Subject: {message['Subject']}",
        "",
        body,
        "",
    ]
    attachments = [part.get_filename() for part in message.iter_attachments()]
    if attachments:
        lines.append("Attachments:")
        for name in attachments:
            lines.append(f"  - {name}")
    else:
        lines.append("Attachments: (none)")
    return "\n".join(lines)


def send_message(message):
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    if not smtp_user:
        raise SendError("SMTP_USER is not set (see .env.example)")
    if not smtp_password:
        raise SendError("SMTP_PASSWORD is not set (see .env.example)")

    host = os.environ.get("SMTP_HOST", "smtp.office365.com")
    port = int(os.environ.get("SMTP_PORT", "587"))

    try:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.starttls()
            smtp.login(smtp_user, smtp_password)
            smtp.send_message(message)
    except smtplib.SMTPException as exc:
        raise SendError(f"SMTP error while sending via {host}:{port}: {exc}") from exc
    except OSError as exc:
        raise SendError(f"could not connect to {host}:{port}: {exc}") from exc


def build_parser():
    parser = argparse.ArgumentParser(
        description="Send (or preview) a drafted job application email over SMTP."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--to", required=True, help="recipient email address")
    common.add_argument("--subject", required=True, help="email subject line")
    common.add_argument("--body", help="plain-text email body")
    common.add_argument("--body-file", help="path to a plain-text file with the email body")
    common.add_argument(
        "--attach",
        action="append",
        default=[],
        help="path to a file to attach (repeatable)",
    )

    sub.add_parser(
        "preview",
        parents=[common],
        help="build the message and print it; touches no network",
    )
    sub.add_parser(
        "send",
        parents=[common],
        help="build the message and actually send it over SMTP",
    )
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        message = build_message(args)
        if args.command == "preview":
            print(render_preview(message))
            return 0
        send_message(message)
        print(f"Sent to {args.to} (subject: {args.subject!r}).")
        return 0
    except SendError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
