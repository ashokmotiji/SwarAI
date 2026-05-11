import unittest
from swarsales_agent.main import _parse_metadata, RoomAgentConfig

class TestAgentLogic(unittest.TestCase):
    def test_parse_metadata_empty(self):
        cfg = _parse_metadata(None)
        self.assertEqual(cfg.speaker, "anushka")
        self.assertEqual(cfg.default_language, "en")

    def test_parse_metadata_valid(self):
        metadata = '{"voiceId": "abhilash", "defaultLanguage": "hi", "supportedLanguages": ["hi", "en"]}'
        cfg = _parse_metadata(metadata)
        self.assertEqual(cfg.speaker, "abhilash")
        self.assertEqual(cfg.default_language, "hi")
        self.assertIn("en", cfg.languages)

    def test_parse_metadata_invalid(self):
        cfg = _parse_metadata("invalid-json")
        self.assertEqual(cfg.speaker, "anushka")

if __name__ == "__main__":
    unittest.main()
