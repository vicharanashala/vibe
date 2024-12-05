from rest_framework import serializers
from .models import Institution

class InstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institution
        # fields = '__all__'
        exclude = ('created_at', 'updated_at')
