from types import SimpleNamespace
from typing import Optional
from unittest.mock import MagicMock, patch


def _profile_upsert_chain(*, execute_side_effect: Optional[Exception] = None):
    chain = MagicMock()
    chain.upsert.return_value = chain
    if execute_side_effect is not None:
        chain.execute.side_effect = execute_side_effect
    else:
        response = MagicMock()
        response.data = [{"id": "user-1"}]
        chain.execute.return_value = response
    return chain


@patch("app.routes.auth.get_supabase_admin_client")
def test_signup_falls_back_if_opt_in_columns_missing(mock_get_admin, anon_client):
    admin = MagicMock()
    admin.auth.admin.create_user.return_value = SimpleNamespace(
        user=SimpleNamespace(id="11111111-1111-1111-1111-111111111111")
    )

    first_upsert = _profile_upsert_chain(
        execute_side_effect=Exception("column profiles.email_opt_in does not exist")
    )
    fallback_upsert = _profile_upsert_chain()
    admin.table.side_effect = [first_upsert, fallback_upsert]
    mock_get_admin.return_value = admin

    resp = anon_client.post(
        "/api/v1/auth/signup",
        json={
            "email": "person@example.com",
            "password": "abc12345",
            "full_name": "Test Person",
            "role": "user",
            "email_opt_in": True,
            "sms_opt_in": True,
        },
    )

    assert resp.status_code == 200
    first_payload = first_upsert.upsert.call_args.args[0]
    fallback_payload = fallback_upsert.upsert.call_args.args[0]
    assert "email_opt_in" in first_payload
    assert "sms_opt_in" in first_payload
    assert "email_opt_in" not in fallback_payload
    assert "sms_opt_in" not in fallback_payload
    admin.auth.admin.delete_user.assert_not_called()


@patch("app.routes.auth.get_supabase_admin_client")
def test_signup_rolls_back_auth_user_if_profile_insert_fails(mock_get_admin, anon_client):
    admin = MagicMock()
    user_id = "22222222-2222-2222-2222-222222222222"
    admin.auth.admin.create_user.return_value = SimpleNamespace(
        user=SimpleNamespace(id=user_id)
    )
    failing_upsert = _profile_upsert_chain(
        execute_side_effect=Exception("permission denied for table profiles")
    )
    admin.table.return_value = failing_upsert
    mock_get_admin.return_value = admin

    resp = anon_client.post(
        "/api/v1/auth/signup",
        json={
            "email": "person2@example.com",
            "password": "abc12345",
            "full_name": "Test Person 2",
            "role": "user",
            "email_opt_in": False,
            "sms_opt_in": False,
        },
    )

    assert resp.status_code == 500
    admin.auth.admin.delete_user.assert_called_once_with(user_id)
