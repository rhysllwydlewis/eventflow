# Marketplace Filter & Sort Status

This document tracks which marketplace filters and sort options are fully functional, which are stubs, and what is needed to complete each one.

**Last Updated:** February 2026

---

## Supplier Search Filters (`/api/v2/search/suppliers`)

| Filter / Sort               | Status        | Notes                                                        |
| --------------------------- | ------------- | ------------------------------------------------------------ |
| Keyword search (`q`)        | ✅ Functional | Full-text weighted relevance search                          |
| Category filter             | ✅ Functional | Exact match on `category` field                              |
| Location (text)             | ✅ Functional | Case-insensitive substring match on location string          |
| Min/max price               | ✅ Functional | Numeric range filter on price fields                         |
| Min rating                  | ✅ Functional | Filter on `calculatedRating`                                 |
| Amenities                   | ✅ Functional | Array intersection filter                                    |
| Min guests                  | ✅ Functional | Numeric filter on capacity                                   |
| Pro only                    | ✅ Functional | Boolean flag filter                                          |
| Featured only               | ✅ Functional | Boolean flag filter                                          |
| Verified only               | ✅ Functional | Boolean flag filter                                          |
| Sort: relevance             | ✅ Functional | Default weighted sort                                        |
| Sort: rating                | ✅ Functional | Sort by `calculatedRating` desc                              |
| Sort: reviews               | ✅ Functional | Sort by `reviewCount` desc                                   |
| Sort: name                  | ✅ Functional | Alphabetical sort                                            |
| Sort: newest                | ✅ Functional | Sort by `createdAt` desc                                     |
| Sort: price asc/desc        | ✅ Functional | Numeric sort on price                                        |
| **Sort: distance**          | ⚠️ **STUB**   | Falls back to relevance order — see below                    |
| **Availability date range** | ⚠️ **STUB**   | No availability fields on supplier documents yet — see below |

---

## Marketplace Listings Filters (`/api/v1/marketplace/listings`)

| Filter / Sort                | Status        | Notes                                                         |
| ---------------------------- | ------------- | ------------------------------------------------------------- |
| Category filter              | ✅ Functional |                                                               |
| Condition filter             | ✅ Functional |                                                               |
| Price range                  | ✅ Functional |                                                               |
| Keyword search               | ✅ Functional |                                                               |
| Sort: newest                 | ✅ Functional | Default                                                       |
| Sort: price low→high         | ✅ Functional |                                                               |
| Sort: price high→low         | ✅ Functional |                                                               |
| **Location/distance filter** | ⚠️ **STUB**   | Saved to localStorage; not applied to API queries — see below |

---

## Stub Details & What's Needed

### Distance Sort (Supplier Search)

**Location:** `search.js` — `searchSuppliers()` function, `sortBy === 'distance'` branch

**Current behaviour:** Falls back to relevance order unchanged.

**What's needed to complete:**

1. Add a `2dsphere` index to the `suppliers` MongoDB collection on a `location.coordinates` field (`[lng, lat]`)
2. Implement a postcode → lat/lng lookup service (e.g. [postcodes.io](https://postcodes.io/) API or a stored lookup table)
3. Refactor `searchSuppliers()` to accept user coordinates as parameters
4. Use MongoDB `$geoNear` aggregation stage (or `$near` operator) to sort by proximity

### Location/Distance Filter (Marketplace Listings)

**Location:** `public/assets/js/marketplace.js` — `applyLocation()` / apply button handler

**Current behaviour:** Postcode and radius are saved to `localStorage` and displayed in the UI, but the `loadListings()` call does not pass location parameters to the API.

**What's needed to complete:**

1. Resolve the stored postcode to lat/lng via a lookup service
2. Pass `lat`, `lng`, and `radius` as query parameters to `GET /api/v1/marketplace/listings`
3. Add geo index and query support to the listings API endpoint
4. Add `location.coordinates` field to listing documents

### Availability Date Range Filter (Supplier Search)

**Current behaviour:** No availability filter exists in the UI or API yet.

**What's needed to complete:**

1. Add `availability` fields (e.g. blocked dates or available date ranges) to supplier documents
2. Add an availability filter parameter to `GET /api/v2/search/suppliers`
3. Implement date-range intersection logic in `searchSuppliers()` in `search.js`
4. Add a date-range picker UI component to the supplier search page

---

## Summary

| Category             | Fully Functional | Stubs / Incomplete         |
| -------------------- | ---------------- | -------------------------- |
| Supplier search      | 11 filters/sorts | 2 (distance, availability) |
| Marketplace listings | 6 filters/sorts  | 1 (location/distance)      |
