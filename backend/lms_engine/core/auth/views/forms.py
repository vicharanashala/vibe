from allauth.account.forms import BaseSignupForm
from django import forms
from allauth.account.adapter import get_adapter
from allauth.account import app_settings
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _

class CustomSignupForm(BaseSignupForm):
    # Remove username field but keep email
    email = forms.EmailField(
        label=_("Email"),
        widget=forms.TextInput(
            attrs={
                "type": "email",
                "placeholder": _("Email address"),
                "autocomplete": "email",
            }
        )
    )
    
    first_name = forms.CharField(
        label=_("First Name"),
        max_length=30,
        widget=forms.TextInput(
            attrs={
                "placeholder": _("First Name"),
                "autocomplete": "given-name"
            }
        )
    )
    
    last_name = forms.CharField(
        label=_("Last Name"),
        max_length=30,
        widget=forms.TextInput(
            attrs={
                "placeholder": _("Last Name"),
                "autocomplete": "family-name"
            }
        )
    )
    
    ROLE_CHOICES = (
        ('user', 'User'),
        ('admin', 'Admin'),
        ('student', 'Student'),
        ('superadmin', 'Super Admin')
    )
    
    role = forms.ChoiceField(
        label=_("Role"),
        choices=ROLE_CHOICES,
        widget=forms.Select(
            attrs={
                "placeholder": _("Select Role"),
            }
        )
    )
    
    password1 = forms.CharField(
        label=_("Password"),
        widget=forms.PasswordInput(
            attrs={
                "placeholder": _("Password"),
                "autocomplete": "new-password"
            }
        )
    )

    def __init__(self, *args, **kwargs):
        kwargs['username_required'] = False  # Explicitly set username as not required
        super().__init__(*args, **kwargs)
        
        # Remove username field from the form fields
        if 'username' in self.fields:
            del self.fields['username']
        
        # Set field order
        self.field_order = ['email', 'first_name', 'last_name', 'role', 'password1']

    def clean_email(self):
        """
        Validate email and check for uniqueness
        """
        email = self.cleaned_data['email'].lower()
        email = get_adapter().clean_email(email)
        if email and app_settings.UNIQUE_EMAIL:
            if get_user_model().objects.filter(email=email).exists():
                raise forms.ValidationError(
                    _("A user is already registered with this email address.")
                )
        return email

    def clean(self):
        """
        Validate all fields
        """
        cleaned_data = super().clean()
        
        # Add any custom validation here
        if cleaned_data.get('role') not in dict(self.ROLE_CHOICES):
            self.add_error('role', _("Invalid role selected."))
            
        return cleaned_data

    def save(self, request):
        """
        Save the user and additional fields
        """
        adapter = get_adapter()
        user = adapter.new_user(request)
        
        # Get cleaned data
        cleaned_data = self.cleaned_data
        
        # Set basic user fields
        user.email = cleaned_data.get('email')
        user.username = cleaned_data.get('email')  # Use email as username
        user.first_name = cleaned_data.get('first_name')
        user.last_name = cleaned_data.get('last_name')
        user.role = cleaned_data.get('role')
        
        # Set password
        adapter.set_password(user, cleaned_data.get('password1'))
        
        adapter.save_user(request, user, self)
        self.custom_signup(request, user)
        
        return user