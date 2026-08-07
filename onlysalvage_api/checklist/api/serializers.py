from rest_framework import serializers

from ..models import BuyerChecklistCategory, BuyerChecklistItem


def _localized(instance, field_prefix, locale):
	# Falls back to the English field when a locale-specific field is left
	# blank -- see BuyerChecklistCategory's docstring in checklist/models.py
	# for why title_en/text_en are the only required language.
	if locale != "en":
		value = getattr(instance, f"{field_prefix}_{locale}")
		if value:
			return value
	return getattr(instance, f"{field_prefix}_en")


class BuyerChecklistItemSerializer(serializers.ModelSerializer):
	text = serializers.SerializerMethodField()
	note = serializers.SerializerMethodField()

	class Meta:
		model = BuyerChecklistItem
		fields = ["id", "icon", "text", "note"]

	def get_text(self, obj):
		return _localized(obj, "text", self.context["locale"])

	def get_note(self, obj):
		# Unlike text/title, an empty note_en is valid (most items have no
		# note at all) -- only fall back to it when it's actually non-empty,
		# rather than always falling back like _localized does for text/title.
		if not obj.note_en:
			return ""
		return _localized(obj, "note", self.context["locale"])


class BuyerChecklistCategorySerializer(serializers.ModelSerializer):
	title = serializers.SerializerMethodField()
	items = BuyerChecklistItemSerializer(many=True, read_only=True)

	class Meta:
		model = BuyerChecklistCategory
		fields = ["id", "icon", "title", "items"]

	def get_title(self, obj):
		return _localized(obj, "title", self.context["locale"])
