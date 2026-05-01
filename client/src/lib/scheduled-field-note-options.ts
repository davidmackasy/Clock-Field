// ─── CUSTOM option sentinel ────────────────────────────────────────────────────
export const CUSTOM_OPTION = "Other / Custom";

// ─────────────────────────────────────────────────────────────────────────────
// COMMERCIAL
// ─────────────────────────────────────────────────────────────────────────────
export const COMMERCIAL_AREA_CATEGORIES = [
  "Washroom", "Office", "Kitchen", "Lobby", "Hallway",
  "Retail Floor", "Dining Area", "Front Counter", "Storage Room",
  "Break Room", "Stairwell", "Entrance", "Back Room", "Garbage Area",
  "Windows / Glass", "Floor Area",
];

export const COMMERCIAL_ROOMS: Record<string, string[]> = {
  "Washroom": [
    "Women's Washroom", "Men's Washroom", "Single-Stall Washroom",
    "Staff Washroom", "Customer Washroom", "Accessible Washroom",
  ],
  "Office": [
    "Office 1", "Office 2", "Office 3", "Office 4", "Office 5",
    "Main Office", "Private Office", "Manager Office", "Admin Office",
    "Upstairs Office", "Downstairs Office", "Boardroom",
    "Reception Office", "Conference Room",
  ],
  "Kitchen": [
    "Commercial Kitchen", "Prep Area", "Dishwashing Area",
    "Sink Area", "Cooking Line", "Back Kitchen", "Kitchen Storage",
  ],
  "Lobby": [
    "Main Lobby", "Reception Area", "Waiting Area", "Entrance Lobby",
  ],
  "Hallway": [
    "Main Hallway", "Hallway 1", "Hallway 2",
    "Upstairs Hallway", "Downstairs Hallway",
  ],
  "Retail Floor": [
    "Main Retail Floor", "Aisle 1", "Aisle 2",
    "Checkout Area", "Display Area",
  ],
  "Dining Area": [
    "Main Dining Area", "Table Section 1", "Table Section 2", "Booth Area",
  ],
  "Front Counter": [
    "Front Counter", "Service Counter", "Reception Counter",
  ],
  "Storage Room": [
    "Storage Room 1", "Storage Room 2", "Supply Room", "Janitor Room",
  ],
  "Break Room": ["Staff Break Room", "Lounge"],
  "Stairwell": [
    "Main Stairwell", "Back Stairwell", "Fire Exit Stairwell",
  ],
  "Entrance": [
    "Front Entrance", "Back Entrance", "Side Entrance", "Employee Entrance",
  ],
  "Back Room": ["Back Room 1", "Back Room 2", "Utility Room"],
  "Garbage Area": ["Indoor Garbage Area", "Outdoor Garbage Area", "Recycling Area"],
  "Windows / Glass": ["Exterior Windows", "Interior Glass", "Glass Doors", "Lobby Glass"],
  "Floor Area": ["Main Floor Area", "Back Area", "Corner Area"],
};

export const COMMERCIAL_ITEMS_BY_AREA: Record<string, string[]> = {
  "Washroom": [
    "Sink", "Mirror", "Toilet", "Toilet Base", "Toilet Seat", "Urinal",
    "Floor", "Wall", "Door Handle", "Soap Dispenser", "Paper Towel Dispenser",
    "Hand Dryer", "Garbage Bin", "Countertop", "Baseboard", "Light Switch", "Partition",
  ],
  "Office": [
    "Desk 1", "Desk 2", "Desk 3", "Keyboard", "Mouse", "Monitor",
    "Chair 1", "Chair 2", "Chair 3", "Table", "Floor", "Carpet",
    "Garbage Bin", "Window", "Door Handle", "Light Switch", "Shelf",
    "Cabinet", "Baseboard", "Phone", "Printer Area",
    "Whiteboard", "Countertop",
  ],
  "Kitchen": [
    "Sink", "Countertop", "Floor", "Stove Area", "Cooking Line",
    "Prep Table", "Dishwashing Area", "Appliance Exterior",
    "Garbage Bin", "Wall Spot", "Baseboard", "Door Handle", "Shelf", "Storage Rack",
  ],
  "Lobby": [
    "Floor", "Carpet", "Front Desk", "Chair", "Table",
    "Glass Door", "Window", "Garbage Bin", "Door Handle", "Baseboard", "Light Switch",
  ],
  "Hallway": [
    "Floor", "Carpet", "Wall Spot", "Door Handle", "Baseboard",
    "Light Switch", "Garbage Bin",
  ],
  "Retail Floor": [
    "Floor", "Aisle", "Shelf", "Display Table", "Checkout Counter",
    "Glass Door", "Window", "Garbage Bin", "Baseboard", "Door Handle",
  ],
  "Dining Area": [
    "Table", "Chair", "Booth", "Floor", "Garbage Bin",
    "Counter", "Window", "Baseboard", "Door Handle",
  ],
  "Front Counter": [
    "Counter", "Glass", "Shelf", "Floor", "Garbage Bin",
    "Door Handle", "Light Switch",
  ],
  "Storage Room": [
    "Floor", "Shelf", "Storage Rack", "Garbage Bin",
    "Door Handle", "Wall Spot", "Baseboard",
  ],
  "Break Room": [
    "Table", "Chair", "Countertop", "Sink", "Microwave Exterior",
    "Fridge Exterior", "Floor", "Garbage Bin", "Door Handle", "Baseboard",
  ],
  "Stairwell": [
    "Stairs", "Handrail", "Landing", "Wall Spot", "Floor", "Door Handle",
  ],
  "Entrance": [
    "Floor", "Mat Area", "Glass Door", "Door Handle", "Window",
    "Baseboard", "Light Switch", "Garbage Bin",
  ],
  "Back Room": [
    "Floor", "Shelf", "Wall Spot", "Door Handle", "Garbage Bin", "Baseboard",
  ],
  "Garbage Area": [
    "Garbage Bin", "Dumpster Area", "Floor", "Wall Spot", "Door Handle",
  ],
  "Windows / Glass": [
    "Window", "Glass Door", "Mirror", "Partition Glass", "Frame",
  ],
  "Floor Area": [
    "Floor", "Carpet", "Baseboard", "Wall Spot", "Door Handle", "Garbage Bin",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// RESIDENTIAL
// ─────────────────────────────────────────────────────────────────────────────
export const RESIDENTIAL_AREA_CATEGORIES = [
  "Bathroom", "Bedroom", "Kitchen", "Living Room", "Dining Room",
  "Laundry Room", "Basement", "Hallway", "Entrance", "Garage",
  "Stairs", "Windows / Glass", "Floor Area",
];

export const RESIDENTIAL_ROOMS: Record<string, string[]> = {
  "Bathroom": [
    "Main Bathroom", "Ensuite Bathroom", "Half Bathroom",
    "Guest Bathroom", "Basement Bathroom", "Bathroom 1", "Bathroom 2",
  ],
  "Bedroom": [
    "Primary Bedroom", "Bedroom 1", "Bedroom 2",
    "Bedroom 3", "Guest Bedroom", "Kids Bedroom",
  ],
  "Kitchen": [
    "Kitchen", "Kitchen Island", "Pantry Area", "Sink Area", "Cooking Area",
  ],
  "Living Room": ["Living Room", "Family Room", "TV Area", "Sitting Area"],
  "Dining Room": ["Dining Room", "Dining Table Area"],
  "Laundry Room": ["Laundry Room", "Washer Area", "Dryer Area"],
  "Basement": ["Basement Room", "Basement Hallway", "Storage Area"],
  "Hallway": ["Main Hallway", "Upper Hallway", "Lower Hallway"],
  "Entrance": ["Front Entrance", "Back Entrance", "Mudroom"],
  "Garage": ["Garage", "Garage Entrance", "Storage Corner"],
  "Stairs": ["Main Stairs", "Basement Stairs"],
  "Windows / Glass": ["Living Room Windows", "Bedroom Windows", "Kitchen Windows"],
  "Floor Area": ["Main Floor", "Upper Floor", "Basement Floor"],
};

export const RESIDENTIAL_ITEMS_BY_AREA: Record<string, string[]> = {
  "Bathroom": [
    "Sink", "Mirror", "Toilet", "Tub", "Shower",
    "Floor", "Countertop", "Cabinet", "Garbage Bin",
    "Door Handle", "Light Switch", "Baseboard", "Wall Spot",
  ],
  "Bedroom": [
    "Bed Area", "Nightstand 1", "Nightstand 2", "Dresser", "Closet",
    "Floor", "Carpet", "Window", "Door Handle", "Garbage Bin",
    "Light Switch", "Baseboard",
  ],
  "Kitchen": [
    "Sink", "Countertop", "Stove", "Fridge Exterior", "Microwave Exterior",
    "Cabinet", "Kitchen Island", "Floor", "Garbage Bin",
    "Door Handle", "Light Switch", "Baseboard",
  ],
  "Living Room": [
    "Couch Area", "Table", "TV Stand", "Floor", "Carpet",
    "Window", "Garbage Bin", "Door Handle", "Light Switch", "Baseboard",
  ],
  "Dining Room": [
    "Dining Table", "Chair", "Floor", "Carpet",
    "Window", "Light Switch", "Baseboard",
  ],
  "Laundry Room": [
    "Washer Exterior", "Dryer Exterior", "Sink", "Countertop",
    "Floor", "Garbage Bin", "Shelf", "Door Handle",
  ],
  "Basement": [
    "Floor", "Carpet", "Storage Shelf", "Window",
    "Garbage Bin", "Door Handle", "Light Switch", "Baseboard",
  ],
  "Hallway": [
    "Floor", "Carpet", "Wall Spot", "Baseboard", "Light Switch", "Door Handle",
  ],
  "Entrance": [
    "Floor", "Door Handle", "Glass Door", "Mat Area",
    "Closet", "Light Switch", "Baseboard",
  ],
  "Garage": [
    "Floor", "Storage Shelf", "Garbage Bin", "Door Handle", "Wall Spot",
  ],
  "Stairs": ["Stairs", "Handrail", "Landing", "Wall Spot", "Floor"],
  "Windows / Glass": ["Window", "Glass Door", "Frame", "Mirror"],
  "Floor Area": ["Floor", "Carpet", "Baseboard", "Wall Spot"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export function getAreaCategories(templateType: string): string[] {
  return templateType === "residential"
    ? RESIDENTIAL_AREA_CATEGORIES
    : COMMERCIAL_AREA_CATEGORIES;
}

export function getRooms(templateType: string, areaCategory: string): string[] {
  const map = templateType === "residential" ? RESIDENTIAL_ROOMS : COMMERCIAL_ROOMS;
  return map[areaCategory] || [];
}

/** Returns area-specific items. Falls back to universal list if area unknown. */
export function getItems(templateType: string, areaCategory?: string): string[] {
  if (templateType === "residential") {
    if (areaCategory && RESIDENTIAL_ITEMS_BY_AREA[areaCategory]) {
      return RESIDENTIAL_ITEMS_BY_AREA[areaCategory];
    }
    return Object.values(RESIDENTIAL_ITEMS_BY_AREA).flat().filter((v, i, a) => a.indexOf(v) === i);
  }
  if (areaCategory && COMMERCIAL_ITEMS_BY_AREA[areaCategory]) {
    return COMMERCIAL_ITEMS_BY_AREA[areaCategory];
  }
  return Object.values(COMMERCIAL_ITEMS_BY_AREA).flat().filter((v, i, a) => a.indexOf(v) === i);
}

export function buildStepTitle(areaName: string, itemLabel: string): string {
  const area = (areaName || "").trim();
  const item = (itemLabel || "").trim();
  if (area && item) return `${area} - ${item}`;
  if (area) return area;
  if (item) return item;
  return "";
}
