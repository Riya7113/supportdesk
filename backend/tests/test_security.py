from uuid import uuid4

from app.security import create_access_token, hash_password, read_access_token, verify_password


def test_password_is_hashed_and_can_be_verified() -> None:
    password = "correct horse battery staple"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("another password", hashed)


def test_access_token_identifies_user_and_rejects_invalid_tokens() -> None:
    user_id = uuid4()
    token = create_access_token(user_id)

    assert read_access_token(token) == user_id
    assert read_access_token("not-a-token") is None
