# CS174a Project Proposal: EscapeCube

### Team Members

Zifan He | 405316865 | zifanhe1202@g.ucla.edu

Yiming Shi | 905525611 | syiming@g.ucla.edu

Shuo Wang | 805260908 | wangshuo17@g.ucla.edu

Nuocheng Pan | 905726493 | np9@g.ucla.edu


**Team representative:**

Shuo Wang

### How to Run the Game
If you have WebStorm or other IDEs, open index.html through Chrome using the IDE. Otherwise, run `server.py` and open `index.html` through Chrome. Follow the keyboard control in the bottom left panel.

**Troubleshooting**:

1. The browser is always spinning: this is due to intensive computation and graphic object loading. Try to clear browser cache and restart the browser.
2. Movement of player is laggy: that's expected if your laptop has only 8GB RAM. Please run the demo on a laptop with more memory.
3. Game stuck at the beginning: please give browser some time to load all objects.
4. Cannot rotate/go back/etc: we applied collision detection throughout the whole arena with some leeway. It is possible that your gun blocks your way of control. Try to rotate and move in another way.
5. Game freeze when resetting: Please restart the browser.

### Theme of the Animation

You are locked in a strange cubicle that you’ve never seen before. WHERE AM I? You screamed. Suddenly, a creepy sound comes from behind. It is a terrifying creature. Is it a dream? You have no idea. The surrounding looks so realistic yet the creatures seem to be from another galaxy.

All you have is a shooting gun in your hand. A voice inside your head continuously tells you to get out of here. There is only one door in the room but it is locked. You gradually find out that beating all the monsters inside of this room is the only way out. You have to kill all the monsters and escape from the cube continuously, otherwise the dream will restart and you will never wake up.



### Game Details

At the beginning of the game, the player and the monsters will randomly spawn in a randomly generated arena (a cube). Depending on characteristics, monsters will randomly move in the arena or shoot bullets. The player needs to eliminate all monsters using his/her gun before the health point goes to zero. After clearing each room, a random perk will be awarded to the player (adding health point, increasing damage of bullet, etc.). The door will open and the player can enter the next room. The final goal is to clear as many rooms as possible.



### Basic Features

- **Model transformation** will be used to build up an arena and control the movement of enemies.
- Mapping from world space to **eye space and projection** is required to render the scene in first person perspective.
- Using **polygons** to construct custom shapes for enemies and terrain.
- Each room has a light source such that we need to compute the **illumination**.



### Interactivity

-  Key binding
    - WASD for player movements
    - QERF for moving views
    - space for firing bullets


### Advanced Features

- **Collision detection** to check whether enemies hit the player and whether the bullets hit the enemies

- **Shadowing** to generate shadows of objects in the arena due to the light source

- **Physical Simulation** for dropping bullet shell and shooting bullet.