// ─── Commercial ───────────────────────────────────────────────────────────────
export const COMMERCIAL_AREA_CATEGORIES = [
  "Office", "Washroom", "Kitchen", "Lobby", "Hallway", "Retail Floor",
  "Storage Room", "Break Room", "Stairwell", "Entrance", "Back Room",
  "Dining Area", "Front Counter", "Garbage Area", "Floor Area", "Windows / Glass",
];

export const COMMERCIAL_ROOMS: Record<string, string[]> = {
  "Office": [
    "Office 1", "Office 2", "Office 3", "Office 4", "Office 5",
    "Main Office", "Private Office", "Manager Office", "Boardroom",
    "Reception Area", "Server Room", "Conference Room",
  ],
  "Washroom": [
    "Women's Washroom", "Men's Washroom", "Single Washroom",
    "Accessible Washroom", "Staff Washroom",
  ],
  "Kitchen": ["Kitchen Area", "Lunch Room", "Cafeteria", "Staff Kitchen"],
  "Lobby": ["Main Lobby", "Elevator Lobby", "Reception Area"],
  "Hallway": [
    "Hallway 1", "Hallway 2", "Hallway 3",
    "Main Hallway", "Back Hallway", "Emergency Exit Hall",
  ],
  "Retail Floor": ["Main Floor", "Back of House", "Fitting Rooms", "Stock Room"],
  "Storage Room": ["Storage Room 1", "Storage Room 2", "Cleaning Supply Room", "Electrical Room"],
  "Break Room": ["Staff Break Room", "Lounge"],
  "Stairwell": ["Main Stairwell", "Back Stairwell", "Fire Exit Stairwell"],
  "Entrance": ["Main Entrance", "Back Entrance", "Side Entrance"],
  "Back Room": ["Back Room 1", "Back Room 2", "Utility Room"],
  "Dining Area": ["Dining Area", "Cafeteria Floor"],
  "Front Counter": ["Front Counter", "Service Counter"],
  "Garbage Area": ["Indoor Garbage Area", "Outdoor Garbage Area", "Recycling Area"],
  "Floor Area": ["Main Floor Area", "Back Area", "Corner Area"],
  "Windows / Glass": ["Exterior Windows", "Interior Glass", "Glass Doors", "Lobby Glass"],
};

export const COMMERCIAL_ITEMS = [
  "Desk 1", "Desk 2", "Desk 3", "Desk 4", "Desk 5",
  "Keyboard", "Mouse", "Monitor",
  "Chair 1", "Chair 2", "Chair 3", "Chair 4",
  "Table", "Counter",
  "Sink", "Toilet", "Toilet Base", "Toilet Seat", "Urinal",
  "Mirror", "Soap Dispenser", "Paper Towel Dispenser", "Hand Dryer",
  "Door Handle", "Light Switch", "Garbage Bin",
  "Floor", "Carpet", "Baseboard",
  "Window", "Glass Door",
  "Shelf", "Appliance", "Wall Spot",
  "Countertop", "Microwave", "Fridge Front", "Stove Top",
];

// ─── Residential ──────────────────────────────────────────────────────────────
export const RESIDENTIAL_AREA_CATEGORIES = [
  "Bedroom", "Bathroom", "Kitchen", "Living Room", "Dining Room",
  "Laundry Room", "Basement", "Hallway", "Entrance", "Garage",
  "Stairs", "Windows / Glass", "Floor Area",
];

export const RESIDENTIAL_ROOMS: Record<string, string[]> = {
  "Bedroom": ["Primary Bedroom", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Guest Bedroom"],
  "Bathroom": ["Main Bathroom", "Ensuite Bathroom", "Half Bathroom", "Powder Room"],
  "Kitchen": ["Kitchen"],
  "Living Room": ["Living Room", "Family Room"],
  "Dining Room": ["Dining Area", "Dining Room"],
  "Laundry Room": ["Laundry Room", "Mudroom"],
  "Basement": ["Basement Room", "Utility Room", "Recreation Room"],
  "Hallway": ["Main Hallway", "Upper Hallway", "Lower Hallway"],
  "Entrance": ["Front Entrance", "Back Entrance"],
  "Garage": ["Garage", "Garage Floor"],
  "Stairs": ["Main Stairs", "Basement Stairs"],
  "Windows / Glass": ["Living Room Windows", "Bedroom Windows", "Kitchen Windows"],
  "Floor Area": ["Main Floor", "Upper Floor", "Basement Floor"],
};

export const RESIDENTIAL_ITEMS = [
  "Bed Area",
  "Nightstand 1", "Nightstand 2",
  "Dresser", "Closet",
  "Sink", "Toilet", "Tub", "Shower",
  "Mirror", "Countertop",
  "Stove", "Fridge", "Microwave", "Cabinet",
  "Table", "Chair 1", "Chair 2", "Couch Area",
  "Floor", "Carpet", "Baseboard",
  "Window", "Door Handle", "Garbage Bin", "Light Switch",
  "Shelf", "Soap Dispenser", "Wall Spot",
  "Washer", "Dryer",
];

export const CUSTOM_OPTION = "Other / Custom";

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getAreaCategories(templateType: string): string[] {
  return templateType === "residential" ? RESIDENTIAL_AREA_CATEGORIES : COMMERCIAL_AREA_CATEGORIES;
}

export function getRooms(templateType: string, areaCategory: string): string[] {
  const map = templateType === "residential" ? RESIDENTIAL_ROOMS : COMMERCIAL_ROOMS;
  return map[areaCategory] || [];
}

export function getItems(templateType: string): string[] {
  return templateType === "residential" ? RESIDENTIAL_ITEMS : COMMERCIAL_ITEMS;
}

export function buildStepTitle(areaName: string, itemLabel: string): string {
  const area = (areaName || "").trim();
  const item = (itemLabel || "").trim();
  if (area && item) return `${area} - ${item}`;
  if (area) return area;
  if (item) return item;
  return "";
}
