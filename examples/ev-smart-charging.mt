// Smart EV charging tariff: a British energy supplier, October 2026.
//
// The supplier sells drivers cheap overnight charging, and sells the same
// flexibility to the system operator. This map uses every part of the v2
// syntax, including the later features, so the parser and the canvas can be
// tested against a realistic map. See docs/syntax/proposal-v2.md.

@map [
  title="Smart EV Charging",
  style=brand,
  evolution=("Genesis", "Custom built", "Product", "Commodity"),
  stages=(17.4, 40, 70),
  visibility=("Visible", "Invisible"),
  legend=(97, 2),
]

@style brand [base=colour, accent="#5b2ee0", warning="#b45309"]
@type regulator [base=component, shape=hexagon, tone=warning]

// Anchors
EV Driver [97.5, 42, type=user]
NESO [96, 68, type=user, label="System operator (NESO)"]
Ofgem [92, 74.5, type=regulator]

// Needs
Cheap Charging [87.2, 55]
Ready by Morning [85, 36.5, label=("Ready by 7am", -30, 12)]

// What the supplier offers
Smart Tariff [76, 58, owner="Product", evolve=72]
Driver App [70.4, 62, sourcing=build, owner="Product"]
Customer Support [66, 78, sourcing=outsource]
Charger Onboarding [72, 30, type=submap, owner="Product"] {
  Compatibility Check [80, 34]; Install Booking [62, 66, sourcing=outsource]
  Compatibility Check -- Install Booking
}

// The differentiator
Charge Scheduling [
  60, 28,
  sourcing=build,
  owner="Flex team",
  evolve=(52, label="Scheduling as a product", sourcing=buy),
  description="Plans each car's charge against prices, grid signals and the driver's deadline",
]
Price Forecasts [50, 34, form=data, owner="Flex team"]
Forecasting Models [44, 22.5, sourcing=build, owner="Flex team"]
Driving Patterns [40, 26, form=data]

// Flexibility, sold to NESO and to the distribution networks
Flexibility [81, 45, pipeline=(8, 80)] {
  `Demand Flexibility Service [DFS]` [81, 58]
  Local Flexibility Markets [81, 18]
  Balancing Mechanism [81, 74, sourcing=buy]
}

// Controlling the cars and chargers
Device Control [54, 52] {
  Vehicle APIs [54, 40, sourcing=buy]
  Charger Clouds [54, 55, inertia]
  OCPP [54, 71, form=practice, label="OCPP 2.0.1"]
}
Home Charger [34, 70, sourcing=buy]
Charger Installers [30, 64, type=ecosystem]
Smart Charge Point Rules [27, 80, form=knowledge]

// Metering, settlement and billing
Billing Platform [
  46, 66,
  type=submap,
  url="https://maptogether.io/r/billing-2026",
  sourcing=buy,
  inertia,
]
Settlement [24, 50, evolve=(80, label="Half-hourly settlement")]
Smart Meter [18, 82]
Wholesale Power [12, 90.5, type=market]
Cloud Compute [6 95 sourcing=outsource]   // spaces separate too; the formatter adds the commas

// Not here yet
Vehicle-to-Grid [62, 12, future]

// Links: the needer on the left
EV Driver -- Cheap Charging
EV Driver -- Ready by Morning
EV Driver -- Driver App
EV Driver -- Charger Onboarding
NESO -- Flexibility [flow, label="£/MWh turned down"]
Ofgem -- Smart Tariff [constraint, label="licence conditions"]
Cheap Charging -- Smart Tariff
Ready by Morning -- Charge Scheduling
Smart Tariff -- Charge Scheduling
Smart Tariff -- Billing Platform
Smart Tariff -- Settlement [constraint]
Smart Tariff -- Customer Support
Driver App -- Charge Scheduling
Charger Onboarding -- Home Charger
Charger Onboarding -- Charger Installers
Flexibility -- Charge Scheduling
Flexibility -- Settlement
Flexibility -- Vehicle-to-Grid [future]
Charge Scheduling -- Price Forecasts
Charge Scheduling -- Device Control
Price Forecasts -- Forecasting Models
Forecasting Models -- Driving Patterns
Forecasting Models -- Wholesale Power
Forecasting Models -- Cloud Compute
Vehicle APIs -- Cloud Compute
Charger Clouds -- Home Charger
OCPP -- Home Charger
Home Charger -- Smart Charge Point Rules [constraint]
Charger Installers -- Home Charger
Billing Platform -- Settlement
Settlement -- Smart Meter
Settlement -- Wholesale Power [flow]
Driver App--Cloud Compute

// Notes and annotations
"Flexibility is sold twice: to the driver as a price, to NESO as turn-down" [74, 8]
"Each charger maker's cloud is its own \"standard\".\nOCPP replaces them as it spreads." [48, 86]
"New chargers must ship with an off-peak default and a random start delay" [on=("Home Charger", "Smart Charge Point Rules")]
"Meters move to half-hourly settlement through May 2027" [on=((24, 50), (18, 82))]

// Forces on the landscape
@accelerator "Market-wide half-hourly settlement" [21, 62]
@accelerator "OCPP as IEC 63584" [57, 64]
@deaccelerator "Closed charger clouds" [50, 47]

// Who works where
@area "Explore" [(66, 5), (36, 32), attitude=pioneers]
@area "Productise" [(80, 50), (56, 68), attitude=settlers]
@area "Industrialise" [(30, 76), (2, 99), attitude=townplanners]
