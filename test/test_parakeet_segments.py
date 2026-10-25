import unittest

from parakeet_transcribe import segments_from_timestamps


class ParakeetSegmentTests(unittest.TestCase):
    def test_splits_character_timestamps_on_pauses_and_long_runs(self):
        chars = [
            {"char": ["前に"], "start": 0, "end": 1},
            {"char": ["褒め"], "start": 1, "end": 2},
            {"char": ["と"], "start": 3, "end": 4},
            {"char": ["いて"], "start": 4, "end": 5},
            {"char": ["一"], "start": 10, "end": 11},
            {"char": ["二"], "start": 11, "end": 12},
            {"char": ["三"], "start": 12, "end": 13},
            {"char": ["四"], "start": 13, "end": 14},
            {"char": ["五"], "start": 14, "end": 15},
            {"char": ["六"], "start": 15, "end": 16},
            {"char": ["七"], "start": 16, "end": 17},
        ]

        self.assertEqual(
            segments_from_timestamps({"char": chars}, max_duration=6),
            [
                {"id": 0, "start": 0, "end": 2, "text": "前に褒め"},
                {"id": 1, "start": 3, "end": 5, "text": "といて"},
                {"id": 2, "start": 10, "end": 16, "text": "一二三四五六"},
                {"id": 3, "start": 16, "end": 17, "text": "七"},
            ],
        )

    def test_merges_a_tiny_boundary_fragment_into_the_previous_cue(self):
        chars = [
            {"char": [letter], "start": index, "end": index + 1}
            for index, letter in enumerate("abcdef")
        ] + [{"char": ["g"], "start": 6, "end": 6.3}]

        self.assertEqual(
            segments_from_timestamps({"char": chars}, max_duration=8),
            [{"id": 0, "start": 0, "end": 6.3, "text": "abcdefg"}],
        )

    def test_does_not_merge_across_sentence_punctuation(self):
        chars = [
            {"char": ["あ。"], "start": 0, "end": 0.2},
            {"char": ["いい。"], "start": 0.3, "end": 0.6},
        ]

        self.assertEqual(
            segments_from_timestamps({"char": chars}),
            [
                {"id": 0, "start": 0, "end": 0.2, "text": "あ。"},
                {"id": 1, "start": 0.3, "end": 0.6, "text": "いい。"},
            ],
        )

    def test_merged_segments_never_exceed_the_duration_limit(self):
        chars = [
            {"char": [letter], "start": index / 10, "end": (index + 1) / 10}
            for index, letter in enumerate("abcdefghij")
        ]

        segments = segments_from_timestamps({"char": chars}, max_duration=0.5)

        self.assertTrue(all(segment["end"] - segment["start"] <= 0.5 for segment in segments))

    def test_uses_segment_timestamps_when_character_timestamps_are_missing(self):
        self.assertEqual(
            segments_from_timestamps({"segment": [{"segment": "こんにちは。", "start": 0, "end": 2}]}),
            [{"id": 0, "start": 0, "end": 2, "text": "こんにちは。"}],
        )


if __name__ == "__main__":
    unittest.main()
