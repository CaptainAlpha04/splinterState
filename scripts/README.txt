Map data pipeline

1) Download Natural Earth admin-1 GeoJSON and place it at:
   data/raw/admin1.geojson

2) Download Natural Earth populated places GeoJSON and place it at:
   data/raw/capitals.geojson

3) Run:
   node scripts/prepareMapData.js

This will emit provinces.json, countries.json, and capitals.json into src/assets/map.
