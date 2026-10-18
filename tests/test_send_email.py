import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from tools.send_email import (
    SendError,
    build_message,
    build_parser,
    main,
    render_preview,
    send_message,
)


class BuildMessageTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.attachment = Path(self.temp_dir.name) / "cv.pdf"
        self.attachment.write_bytes(b"%PDF-1.4 fake content")

    def tearDown(self):
        self.temp_dir.cleanup()

    def _args(self, **overrides):
        args = build_parser().parse_args(
            [
                "preview",
                "--to",
                overrides.get("to", "contact@cenit.ma"),
                "--subject",
                overrides.get("subject", "Stage IA"),
                "--body",
                overrides.get("body", "Bonjour,"),
                "--attach",
                str(self.attachment),
            ]
        )
        return args

    @patch.dict("os.environ", {"SMTP_USER": "me@outlook.com"}, clear=True)
    def test_builds_message_with_attachment(self):
        message = build_message(self._args())
        self.assertEqual(message["To"], "contact@cenit.ma")
        self.assertEqual(message["Subject"], "Stage IA")
        self.assertIn("me@outlook.com", message["From"])
        attachments = [part.get_filename() for part in message.iter_attachments()]
        self.assertEqual(attachments, ["cv.pdf"])

    @patch.dict(
        "os.environ",
        {"SMTP_USER": "me@outlook.com", "SMTP_FROM_NAME": "Jane Doe"},
        clear=True,
    )
    def test_from_header_includes_display_name(self):
        message = build_message(self._args())
        self.assertEqual(message["From"], "Jane Doe <me@outlook.com>")

    def test_missing_attachment_raises(self):
        args = build_parser().parse_args(
            [
                "preview",
                "--to",
                "contact@cenit.ma",
                "--subject",
                "Stage IA",
                "--body",
                "Bonjour,",
                "--attach",
                str(Path(self.temp_dir.name) / "does-not-exist.pdf"),
            ]
        )
        with self.assertRaisesRegex(SendError, "does not exist"):
            build_message(args)

    def test_empty_attachment_raises(self):
        empty = Path(self.temp_dir.name) / "empty.pdf"
        empty.touch()
        args = build_parser().parse_args(
            [
                "preview",
                "--to",
                "contact@cenit.ma",
                "--subject",
                "Stage IA",
                "--body",
                "Bonjour,",
                "--attach",
                str(empty),
            ]
        )
        with self.assertRaisesRegex(SendError, "empty"):
            build_message(args)

    def test_missing_body_raises(self):
        args = build_parser().parse_args(
            [
                "preview",
                "--to",
                "contact@cenit.ma",
                "--subject",
                "Stage IA",
                "--attach",
                str(self.attachment),
            ]
        )
        with self.assertRaisesRegex(SendError, "--body"):
            build_message(args)


class RenderPreviewTests(unittest.TestCase):
    @patch.dict("os.environ", {"SMTP_USER": "me@outlook.com"}, clear=True)
    def test_preview_lists_attachments_and_body(self):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        attachment = Path(temp_dir.name) / "cv.pdf"
        attachment.write_bytes(b"fake")
        args = build_parser().parse_args(
            [
                "preview",
                "--to",
                "contact@cenit.ma",
                "--subject",
                "Stage IA",
                "--body",
                "Bonjour,",
                "--attach",
                str(attachment),
            ]
        )
        preview = render_preview(build_message(args))
        self.assertIn("To:      contact@cenit.ma", preview)
        self.assertIn("Subject: Stage IA", preview)
        self.assertIn("Bonjour,", preview)
        self.assertIn("cv.pdf", preview)


class SendMessageTests(unittest.TestCase):
    @patch.dict("os.environ", {}, clear=True)
    def test_missing_credentials_raises(self):
        with self.assertRaisesRegex(SendError, "SMTP_USER"):
            send_message(MagicMock())

    @patch.dict("os.environ", {"SMTP_USER": "me@outlook.com"}, clear=True)
    def test_missing_password_raises(self):
        with self.assertRaisesRegex(SendError, "SMTP_PASSWORD"):
            send_message(MagicMock())

    @patch.dict(
        "os.environ",
        {"SMTP_USER": "me@outlook.com", "SMTP_PASSWORD": "secret"},
        clear=True,
    )
    @patch("tools.send_email.smtplib.SMTP")
    def test_send_success_calls_starttls_login_send(self, mock_smtp_cls):
        mock_smtp = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_smtp
        message = MagicMock()

        send_message(message)

        mock_smtp_cls.assert_called_once_with("smtp.office365.com", 587, timeout=30)
        mock_smtp.starttls.assert_called_once()
        mock_smtp.login.assert_called_once_with("me@outlook.com", "secret")
        mock_smtp.send_message.assert_called_once_with(message)


class MainTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.attachment = Path(self.temp_dir.name) / "cv.pdf"
        self.attachment.write_bytes(b"fake")

    def tearDown(self):
        self.temp_dir.cleanup()

    @patch.dict("os.environ", {"SMTP_USER": "me@outlook.com"}, clear=True)
    def test_preview_never_touches_network(self):
        with patch("tools.send_email.smtplib.SMTP") as mock_smtp_cls:
            exit_code = main(
                [
                    "preview",
                    "--to",
                    "contact@cenit.ma",
                    "--subject",
                    "Stage IA",
                    "--body",
                    "Bonjour,",
                    "--attach",
                    str(self.attachment),
                ]
            )
        self.assertEqual(exit_code, 0)
        mock_smtp_cls.assert_not_called()

    @patch.dict("os.environ", {}, clear=True)
    def test_send_without_credentials_exits_nonzero(self):
        exit_code = main(
            [
                "send",
                "--to",
                "contact@cenit.ma",
                "--subject",
                "Stage IA",
                "--body",
                "Bonjour,",
                "--attach",
                str(self.attachment),
            ]
        )
        self.assertEqual(exit_code, 1)


if __name__ == "__main__":
    unittest.main()
