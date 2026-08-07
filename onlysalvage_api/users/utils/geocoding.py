import pgeocode
# import requests

nomi = pgeocode.Nominatim('us')

def zip_to_coordinates(zip):
  info = nomi.query_postal_code(zip)
  return info.longitude, info.latitude

# def zip_to_coordinates(zip):
#   url = f"https://geocoding-api.open-meteo.com/v1/search?name={zip}"
#   response = requests.get(url).json()["results"]
#
#   for r in response:
#     if r["country"] == "United States":
#       return r["longitude"], r["latitude"]
#
#   return 0, 0