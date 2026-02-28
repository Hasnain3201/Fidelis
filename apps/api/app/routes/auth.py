from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.db.supabase import get_supabase_client

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(payload: LoginRequest):
    client = get_supabase_client()

    if client is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client not configured"
        )

    try:
        # Basic check from users table
        response = (
            client.table("users")
            .select("id,email,password")
            .eq("email", payload.email)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    user = response.data

    if not user or user["password"] != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    return {
        "message": "Login successful",
        "user_id": user["id"],
        "email": user["email"]
    }