from django import forms
from .models import Video

class VideoForm(forms.ModelForm):
    class Meta:
        model = Video
        fields = ['section', 'link', 'sequence']  # Only include section, link, and sequence

    def clean(self):
        cleaned_data = super().clean()
        url = cleaned_data.get("link")
        if not url:
            raise forms.ValidationError("URL is required.")
        return cleaned_data
