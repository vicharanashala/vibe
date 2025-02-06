def add_x_tag_groups(result, generator, request, public):
    """
    Add x-tagGroups to the OpenAPI schema.

    Args:
        result (dict): The OpenAPI schema.
        generator (BaseSchemaGenerator): The schema generator instance.
        request (Request): The current request.
        public (bool): Whether the schema is public or private.

    Returns:
        dict: The modified schema.
    """
    result["x-tagGroups"] = [
        {"name": "Users", "tags": ["User", "UserInstitution", "UserCourseInstance"]},
        {"name": "Authentication", "tags": ["Auth"]},
        {
            "name": "Courses",
            "tags": [
                "Course",
                "Course Instance",
                "Module",
                "Section",
                "Item",
                "Video",
                "Article",
            ],
        },
        {
            "name": "Assessments",
            "tags": ["Assessment", "Question", "Solution"],
        },
    ]
    return result
