from __future__ import annotations

from typing import Literal

DisplayCategory = Literal["normal", "review_recommended", "attack"]

REVIEW_THRESHOLD = 0.4
ATTACK_THRESHOLD = 0.5


def get_display_category(
    model_result: Literal["normal", "attack"],
    attack_probability: float,
) -> DisplayCategory:
    # Review Recommended is a probability-threshold display category, not a third ML class.
    if model_result == "attack" or attack_probability >= ATTACK_THRESHOLD:
        return "attack"
    if attack_probability >= REVIEW_THRESHOLD:
        return "review_recommended"
    return "normal"
