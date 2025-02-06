from django.shortcuts import render
from django.urls import reverse


def api_docs(request):
    schema_url = reverse("api_schema")
    return render(request, "api_docs.html", {"schema_url": schema_url})
