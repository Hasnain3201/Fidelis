"""Prompt templates for AI-based venue data extraction."""


class VenuePrompts:

    @staticmethod
    def get_venue_extraction_prompt(
        url: str,
        text_content: str,
        structured_data: list,
        meta_data: dict,
        phones: list,
        emails: list,
    ) -> str:
        return f"""
Please analyze the website at {url} and extract venue information in a structured JSON format.

WEBSITE CONTENT TO ANALYZE:
{text_content}

Additional context from scraping:
Found Structured Data: {structured_data}
Found Meta Data: {meta_data}
Found Phones: {phones}
Found Emails: {emails}

Please extract and structure the following information into a JSON object:

{{
    "venue_name": "string",
    "description": "string (1-3 sentence summary of the venue)",
    "venue_address": {{
        "street": "string",
        "city": "string",
        "state": "string",
        "zip_code": "string",
        "country": "string"
    }},
    "legal_entity_name": "string",
    "legal_entity_address": {{
        "street": "string",
        "city": "string",
        "state": "string",
        "zip_code": "string",
        "country": "string"
    }},
    "federal_id_number": "string",
    "primary_contact": {{
        "name": "string",
        "phone": "string",
        "phone_type": "landline or mobile",
        "alt_phone": "string",
        "alt_phone_type": "landline or mobile",
        "email": "string"
    }},
    "venue_type": "REQUIRED. Pick exactly one of: Bar, Restaurant, Theatre, Concert Hall, Art Gallery, Cinema, Museum, Church, Park, Private, Hotel, Stadium, Arena, Library, Marina, Other",
    "website": "string",
    "phone_number": "string",
    "capacity": "string",
    "confidence_score": "number between 0-100"
}}

Rules:
1. If information is not available, use "N/A" or null
2. For venue_type, choose the most appropriate category or "Other" if none fit
3. Phone numbers should be formatted consistently
4. Addresses should be broken down into components (street, city, state, zip_code, country)
5. Look carefully for address information in the text
6. Extract venue name from the main heading or title
7. Look for contact information including phone numbers and email addresses
8. Determine venue type based on the content (restaurant, bar, etc.)
9. Provide a confidence score based on how much information you could extract
10. Be thorough - extract all available information from the text
11. Return ONLY the JSON object, no additional text
"""
