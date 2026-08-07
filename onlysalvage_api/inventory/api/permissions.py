from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsListingOwner(BasePermission):
  def has_object_permission(self, request, view, obj):
    if request.method in SAFE_METHODS:
      return True

    return obj.seller == request.user


class IsListingImageOwner(BasePermission):
  def has_object_permission(self, request, view, obj):
    if request.method in SAFE_METHODS:
      return True

    return obj.listing.seller == request.user