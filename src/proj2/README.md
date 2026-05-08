The aesthetic inspiration for this project was based on the original, [Dorian Concept - Hide](https://www.youtube.com/watch?v=tlFolRo1WiE), music video.
I wanted to lean into the retro, VHS, broken distorted video aesthetic that the original music video had. 

In the old version, before I could work on the aesthetic I needed a main subject for my scene, so I tried out using [sdfs](https://iquilezles.org/articles/distfunctions2d/). 
After I got my subject, in order to achieve a similar aesthetic to the video I made a color bleeding post-processing effect which simply me offsetting the 
red, green, and blue channels in certain directions. Additionally, I added effects such as pixel sorting, inspired [here](https://www.youtube.com/watch?v=HMmmBDRy-jE) and other 
[glitchy post processing effects](https://www.youtube.com/watch?v=MOCtUJUfq7M). These effects are switched out periodically based on some timing
constants I specified at the beginning so that the switches are in time with the track. For the cherry on top, I added a blue filter that increased in intensity 
over the length of the animation, reaching full. In the new version I created a sky background similar to the video using noise functions for clouds that move 
slightly and a rotated gradient. I also created a letter boxing effect that framed
the main scene at the center.

Old Feedback: "Oh my gosh this is so cool! This whole thing feels so hypnotyzing, dynamic, and engaging! 
The animations are so well suited to the music, and everything feels so textured and layered. The 
repeating elements that get added onto every time are such a nice touch and really nice themes and 
continuity throughout."

12 functions
- fract
- sin
- dot
- floor
- mix
- clamp
- smoothstep
- step
- normalize
- length
- cos
- textureSample
