from django.contrib import admin

from .models import BuyerChecklistCategory, BuyerChecklistItem


class BuyerChecklistItemInline(admin.TabularInline):
	model = BuyerChecklistItem
	extra = 1
	fields = [
		"order", "icon",
		"text_en", "text_uk", "text_ru", "text_es", "text_ro",
		"note_en", "note_uk", "note_ru", "note_es", "note_ro",
	]


@admin.register(BuyerChecklistCategory)
class BuyerChecklistCategoryAdmin(admin.ModelAdmin):
	list_display = ["title_en", "icon", "order", "item_count"]
	list_editable = ["order"]
	search_fields = ["title_en", "title_uk", "title_ru", "title_es", "title_ro"]
	inlines = [BuyerChecklistItemInline]

	@admin.display(description="Items")
	def item_count(self, obj):
		return obj.items.count()
