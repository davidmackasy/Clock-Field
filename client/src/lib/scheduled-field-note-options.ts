export const COMMERCIAL_AREA_CATEGORIES = [
  "Washroom", "Office", "Kitchen", "Lobby", "Hallway", "Retail Floor",
  "Storage Room", "Break Room", "Stairwell", "Entrance", "Glass / Windows",
  "Floor Area", "Garbage Area",
];

export const COMMERCIAL_ROOMS: Record<string, string[]> = {
  "Washroom": ["Women's Washroom", "Men's Washroom", "Single-Stall Washroom", "Accessible Washroom"],
  "Office": ["Main Office", "Manager Office", "Front Desk", "Conference Room", "Server Room"],
  "Kitchen": ["Staff Kitchen", "Lunch Room", "Cafeteria"],
  "Lobby": ["Main Lobby", "Elevator Lobby", "Reception"],
  "Hallway": ["Main Hallway", "Back Hallway", "Emergency Exit Hall"],
  "Retail Floor": ["Main Floor", "Back of House", "Fitting Rooms"],
  "Storage Room": ["Main Storage", "Cleaning Supply Room", "Electrical Room"],
  "Break Room": ["Staff Break Room", "Lounge"],
  "Stairwell": ["Main Stairwell", "Fire Exit Stairwell"],
  "Entrance": ["Front Entrance", "Back Entrance", "Side Entrance"],
  "Glass / Windows": ["Exterior Windows", "Interior Glass", "Glass Doors"],
  "Floor Area": ["Main Floor Area", "Back Area", "Corner Area"],
  "Garbage Area": ["Indoor Garbage Area", "Outdoor Garbage Area", "Recycling Area"],
};

export const COMMERCIAL_ITEMS: Record<string, string[]> = {
  "Washroom": ["Toilet", "Urinal", "Sink", "Mirror", "Countertop", "Garbage Bin", "Floor", "Dispenser", "Paper Towel Holder", "Soap Dispenser", "Light Switch", "Door Handle"],
  "Office": ["Desk", "Chair", "Table", "Countertop", "Garbage Bin", "Floor", "Carpet", "Baseboard", "Wall Spot", "Window", "Light Switch"],
  "Kitchen": ["Stove Top", "Microwave", "Fridge Front", "Sink", "Countertop", "Table", "Chair", "Floor", "Garbage Bin", "Appliance", "Shelf"],
  "Lobby": ["Floor", "Carpet", "Reception Desk", "Chairs", "Glass Door", "Window", "Garbage Bin", "Baseboard"],
  "Hallway": ["Floor", "Carpet", "Baseboard", "Door Handle", "Light Switch", "Wall Spot"],
  "Retail Floor": ["Floor", "Carpet", "Shelf", "Counter", "Garbage Bin", "Window", "Door Handle"],
  "Storage Room": ["Floor", "Shelf", "Garbage Bin", "Door Handle"],
  "Break Room": ["Table", "Chair", "Floor", "Garbage Bin", "Countertop", "Appliance"],
  "Stairwell": ["Steps", "Handrail", "Floor Landing", "Baseboard"],
  "Entrance": ["Floor", "Door Handle", "Glass Door", "Doormat", "Baseboard"],
  "Glass / Windows": ["Window Glass", "Window Frame", "Glass Door", "Mirror"],
  "Floor Area": ["Floor", "Carpet", "Baseboard"],
  "Garbage Area": ["Garbage Bins", "Recycling Bins", "Floor Area"],
};

export const RESIDENTIAL_AREA_CATEGORIES = [
  "Bedroom", "Bathroom", "Kitchen", "Living Room", "Dining Room",
  "Basement", "Laundry Room", "Hallway", "Entrance", "Garage",
  "Stairs", "Windows", "Floor Area",
];

export const RESIDENTIAL_ROOMS: Record<string, string[]> = {
  "Bedroom": ["Primary Bedroom", "Guest Bedroom", "Kids Bedroom"],
  "Bathroom": ["Main Bathroom", "Ensuite Bathroom", "Powder Room"],
  "Kitchen": ["Kitchen"],
  "Living Room": ["Living Room", "Family Room"],
  "Dining Room": ["Dining Room", "Dining Area"],
  "Basement": ["Basement Room", "Utility Room"],
  "Laundry Room": ["Laundry Room", "Mudroom"],
  "Hallway": ["Main Hallway", "Upper Hallway"],
  "Entrance": ["Front Entrance", "Back Entrance"],
  "Garage": ["Garage Floor", "Garage Storage"],
  "Stairs": ["Main Stairs", "Basement Stairs"],
  "Windows": ["Living Room Windows", "Bedroom Windows", "Kitchen Windows"],
  "Floor Area": ["Main Floor", "Upper Floor", "Basement Floor"],
};

export const RESIDENTIAL_ITEMS: Record<string, string[]> = {
  "Bedroom": ["Bed Area", "Nightstand", "Dresser", "Closet", "Floor", "Carpet", "Window", "Baseboard", "Light Switch"],
  "Bathroom": ["Sink", "Toilet", "Tub", "Shower", "Mirror", "Countertop", "Floor", "Garbage Bin", "Door Handle", "Soap Dispenser"],
  "Kitchen": ["Stove", "Fridge", "Microwave", "Cabinet", "Countertop", "Sink", "Floor", "Table", "Chair", "Garbage Bin"],
  "Living Room": ["Couch Area", "Table", "Chair", "Floor", "Carpet", "Window", "Baseboard", "Light Switch"],
  "Dining Room": ["Table", "Chair", "Floor", "Window", "Baseboard"],
  "Basement": ["Floor", "Carpet", "Baseboard", "Window"],
  "Laundry Room": ["Washer", "Dryer", "Floor", "Shelf", "Garbage Bin"],
  "Hallway": ["Floor", "Carpet", "Baseboard", "Door Handle"],
  "Entrance": ["Floor", "Doormat", "Door Handle", "Baseboard"],
  "Garage": ["Floor", "Shelf", "Garbage Bin"],
  "Stairs": ["Steps", "Handrail", "Carpet"],
  "Windows": ["Window Glass", "Window Frame", "Window Sill"],
  "Floor Area": ["Floor", "Carpet", "Baseboard"],
};

export const CUSTOM_OPTION = "Other / Custom";

export function getAreaCategories(templateType: string): string[] {
  return templateType === "residential" ? RESIDENTIAL_AREA_CATEGORIES : COMMERCIAL_AREA_CATEGORIES;
}

export function getRooms(templateType: string, areaCategory: string): string[] {
  const map = templateType === "residential" ? RESIDENTIAL_ROOMS : COMMERCIAL_ROOMS;
  return map[areaCategory] || [];
}

export function getItems(templateType: string, areaCategory: string): string[] {
  const map = templateType === "residential" ? RESIDENTIAL_ITEMS : COMMERCIAL_ITEMS;
  return map[areaCategory] || [];
}

export function buildStepTitle(areaName: string, itemType: string): string {
  const area = areaName.replace(CUSTOM_OPTION, "").trim();
  const item = itemType.replace(CUSTOM_OPTION, "").trim();
  if (area && item) return `${area} - ${item}`;
  if (area) return area;
  if (item) return item;
  return "";
}
