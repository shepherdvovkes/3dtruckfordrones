import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
from matplotlib.patches import Polygon
import random

# Set up the figure and axis
fig, ax = plt.subplots(1, 1, figsize=(16, 10))
ax.set_xlim(0, 100)
ax.set_ylim(0, 60)
ax.set_aspect('equal')

# Sky gradient (blue to light blue)
for i in range(40, 60):
    alpha = (i - 40) / 20
    color = (0.5 + alpha * 0.3, 0.7 + alpha * 0.2, 1.0)
    ax.axhspan(i, i+1, facecolor=color, alpha=0.8)

# Desert sand
ax.axhspan(0, 25, facecolor='#F4A460', alpha=0.9)

# Mountains in the background
mountain_x = [0, 15, 25, 35, 50, 65, 80, 90, 100]
mountain_y = [25, 45, 35, 50, 40, 48, 35, 42, 25]
mountain_polygon = Polygon(list(zip(mountain_x, mountain_y)), 
                          facecolor='#8B4513', alpha=0.7, edgecolor='#654321')
ax.add_patch(mountain_polygon)

# Highway
highway_y = 15
highway_width = 8
highway = patches.Rectangle((0, highway_y), 100, highway_width, 
                           facecolor='#2F2F2F', alpha=0.8)
ax.add_patch(highway)

# Highway lane markings
for x in range(5, 100, 10):
    lane_mark = patches.Rectangle((x, highway_y + highway_width/2 - 0.5), 4, 1, 
                                 facecolor='white', alpha=0.9)
    ax.add_patch(lane_mark)

# Function to draw a truck
def draw_truck(x, y, color, size=1.0):
    # Truck cab
    cab_width = 4 * size
    cab_height = 3 * size
    cab = patches.Rectangle((x, y), cab_width, cab_height, 
                           facecolor=color, edgecolor='black', linewidth=1)
    ax.add_patch(cab)
    
    # Truck trailer
    trailer_width = 8 * size
    trailer_height = 4 * size
    trailer = patches.Rectangle((x + cab_width, y - 0.5 * size), trailer_width, trailer_height, 
                               facecolor=color, edgecolor='black', linewidth=1, alpha=0.8)
    ax.add_patch(trailer)
    
    # Wheels
    wheel_radius = 0.8 * size
    wheel1 = patches.Circle((x + 1.5 * size, y - 0.5 * size), wheel_radius, 
                           facecolor='black', edgecolor='gray')
    wheel2 = patches.Circle((x + cab_width + 2 * size, y - 0.5 * size), wheel_radius, 
                           facecolor='black', edgecolor='gray')
    wheel3 = patches.Circle((x + cab_width + 6 * size, y - 0.5 * size), wheel_radius, 
                           facecolor='black', edgecolor='gray')
    ax.add_patch(wheel1)
    ax.add_patch(wheel2)
    ax.add_patch(wheel3)
    
    # Window
    window = patches.Rectangle((x + 0.5 * size, y + 1.5 * size), 2 * size, 1 * size, 
                              facecolor='lightblue', edgecolor='black', alpha=0.7)
    ax.add_patch(window)

# Truck caravan with different colors
truck_colors = ['red', 'blue', 'green', 'orange', 'purple', 'yellow']
truck_positions = [10, 25, 40, 55, 70, 85]

for i, (pos, color) in enumerate(zip(truck_positions, truck_colors)):
    truck_y = highway_y + 1
    draw_truck(pos, truck_y, color, size=0.8)

# Function to draw a cactus
def draw_cactus(x, y, height=8):
    # Main trunk
    trunk = patches.Rectangle((x - 0.5, y), 1, height, 
                             facecolor='green', edgecolor='darkgreen')
    ax.add_patch(trunk)
    
    # Arms
    if height > 5:
        # Left arm
        left_arm = patches.Rectangle((x - 3, y + height * 0.6), 2.5, 0.8, 
                                   facecolor='green', edgecolor='darkgreen')
        ax.add_patch(left_arm)
        left_arm_up = patches.Rectangle((x - 3, y + height * 0.6), 0.8, height * 0.3, 
                                      facecolor='green', edgecolor='darkgreen')
        ax.add_patch(left_arm_up)
        
        # Right arm
        right_arm = patches.Rectangle((x + 0.5, y + height * 0.7), 2.5, 0.8, 
                                    facecolor='green', edgecolor='darkgreen')
        ax.add_patch(right_arm)
        right_arm_up = patches.Rectangle((x + 2.2, y + height * 0.7), 0.8, height * 0.25, 
                                       facecolor='green', edgecolor='darkgreen')
        ax.add_patch(right_arm_up)

# Cacti on the left side of the road
cactus_positions = [5, 15, 30, 45, 60, 75, 90]
for pos in cactus_positions:
    height = random.uniform(6, 12)
    draw_cactus(pos - 8, 25, height)

# Cannabis/hemp fields on the right side
def draw_plant_field(start_x, end_x, y_base):
    for x in range(start_x, end_x, 3):
        for offset in [0, 1, 2]:
            plant_x = x + offset + random.uniform(-0.5, 0.5)
            plant_height = random.uniform(3, 6)
            
            # Plant stem
            stem = patches.Rectangle((plant_x - 0.2, y_base), 0.4, plant_height, 
                                   facecolor='#228B22', alpha=0.8)
            ax.add_patch(stem)
            
            # Leaves (simplified as small rectangles)
            for i in range(3):
                leaf_y = y_base + plant_height * (0.3 + i * 0.2)
                leaf_left = patches.Rectangle((plant_x - 1.5, leaf_y), 1.3, 0.3, 
                                            facecolor='#32CD32', alpha=0.7)
                leaf_right = patches.Rectangle((plant_x + 0.2, leaf_y), 1.3, 0.3, 
                                             facecolor='#32CD32', alpha=0.7)
                ax.add_patch(leaf_left)
                ax.add_patch(leaf_right)

# Hemp/cannabis fields on the right side of highway
draw_plant_field(25, 95, 25)

# Sun
sun = patches.Circle((85, 50), 4, facecolor='yellow', edgecolor='orange', linewidth=2)
ax.add_patch(sun)

# Clouds
cloud1 = patches.Ellipse((20, 52), 8, 3, facecolor='white', alpha=0.8)
cloud2 = patches.Ellipse((60, 48), 6, 2.5, facecolor='white', alpha=0.8)
ax.add_patch(cloud1)
ax.add_patch(cloud2)

# Title and cleanup
ax.set_title('Desert Truck Caravan', fontsize=20, fontweight='bold', pad=20)
ax.axis('off')

# Save the image
plt.tight_layout()
plt.savefig('desert_caravan.png', dpi=300, bbox_inches='tight')
plt.show()

print("Desert caravan scene created and saved as 'desert_caravan.png'")