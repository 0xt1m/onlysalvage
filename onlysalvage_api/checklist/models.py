from django.db import models

# Matches the site's 5 supported locales (see User.PreferredLocale and the
# frontend's messages/*.json files) -- kept as a plain tuple rather than a
# TextChoices since it's used to build field names dynamically (see
# LOCALE_CODES below), not stored as a value on any model itself.
LOCALE_CODES = ("en", "uk", "ru", "es", "ro")


class BuyerChecklistCategory(models.Model):
	"""One section of the /checklist page (e.g. "Understand the Title").
	Admin-managed (see checklist/admin.py) so the site owner can add, reorder,
	or edit this content without a code deploy -- unlike the rest of the
	site's static UI copy, which lives in messages/*.json instead.

	title_en is the only required language -- BuyerChecklistView falls back
	to it for any locale left blank, so a newly added category/item is
	usable immediately in English while the other translations catch up.
	"""
	order = models.PositiveSmallIntegerField(default=0)
	# Lucide icon name (e.g. "FileText") -- validated informally, not against
	# a fixed choices list, since the icon set the frontend ships is its own
	# concern; an unrecognized name just falls back to a default icon there.
	icon = models.CharField(max_length=50, blank=True, help_text="Lucide icon name, e.g. \"FileText\".")

	title_en = models.CharField(max_length=200)
	title_uk = models.CharField(max_length=200, blank=True)
	title_ru = models.CharField(max_length=200, blank=True)
	title_es = models.CharField(max_length=200, blank=True)
	title_ro = models.CharField(max_length=200, blank=True)

	class Meta:
		ordering = ["order", "id"]
		verbose_name_plural = "Buyer checklist categories"

	def __str__(self):
		return self.title_en


class BuyerChecklistItem(models.Model):
	"""One checkbox line within a BuyerChecklistCategory."""
	category = models.ForeignKey(BuyerChecklistCategory, on_delete=models.CASCADE, related_name="items")
	order = models.PositiveSmallIntegerField(default=0)

	# Same free-text Lucide icon name convention as
	# BuyerChecklistCategory.icon -- optional, an item with none just shows
	# its checkbox without an illustration.
	icon = models.CharField(max_length=50, blank=True, help_text="Lucide icon name, e.g. \"Wrench\".")

	text_en = models.TextField()
	text_uk = models.TextField(blank=True)
	text_ru = models.TextField(blank=True)
	text_es = models.TextField(blank=True)
	text_ro = models.TextField(blank=True)

	# Optional supplementary detail shown under an item's main text (e.g. a
	# time-sensitive caveat) -- left blank on most items. Unlike text_*,
	# an empty note_en is valid (it means "no note"), so the API only falls
	# back note_uk/ru/es/ro to note_en when note_en itself is non-empty.
	note_en = models.TextField(blank=True)
	note_uk = models.TextField(blank=True)
	note_ru = models.TextField(blank=True)
	note_es = models.TextField(blank=True)
	note_ro = models.TextField(blank=True)

	class Meta:
		ordering = ["order", "id"]

	def __str__(self):
		return self.text_en[:60]
