"""Tea box and tea bag layout (SPEC.md section 7, phase 2b, slice D3), shared by two scripts.

`steps/04_room.py` builds the box body (part of `Room`) from the slot positions, `steps/08_tea_bags.py` builds the four `TeaBag_<i>`
objects that stand in those slots. Plain Python (no bpy), metres, Blender axes (x right, y back, z up, worktop top z = 0).
"""

# Box: centre of the footprint (x, y) and outer size (x, y, z). Open top, four slots in a row along x.
BOX_CENTER = (0.19, -0.15)
BOX_SIZE = (0.12, 0.07, 0.045)
BOX_WALL = 0.004  # front and back wall thickness
BOX_FLOOR = 0.015  # solid base: the slot floor, so a bag stands 30 mm deep in its slot

# Bags: x of the centre of every packet (pitch 30 mm), y of the centre, footprint (x wide, y deep), height, base height (= BOX_FLOOR).
BAG_X = (0.145, 0.175, 0.205, 0.235)
BAG_Y = -0.15
BAG_W, BAG_D, BAG_H = 0.022, 0.040, 0.060
BAG_BASE_Z = BOX_FLOOR

# Slots: one per bag, SLOT_W wide in x (1 mm of play each side of a bag), the walls between them are the dividers.
SLOT_W = 0.024
