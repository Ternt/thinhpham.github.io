The aesthetic goal was to simulate the look of a firecracker sparkle, particles that explode out from a point and fade as they arc downward 
under gravity.

Particles stores its position, velocity, life, and color in two separate flat buffers. State1 holds the physics state plus a ring buffer 
of N historical positions (N since this can be adjusted, default is 16), and state2 holds per-particle life and RGB color. Every compute 
tick the particle's current position is stamped into the ring buffer before physics are applied, creating an equally-spaced breadcrumb trail 
along the exact arc the particle traveled. The renderer then draws 64 × trail_length instances per frame, where each instance reads its position 
from a specific slot in the ring buffer, the newest slot renders at full size and opacity, and each older slot fades and shrinks according to a 
power curve, producing the ghost trail effect. Spawning is triggered by writing a clip-space coordinate and a trigger flag into a spawn uniform, 
which the compute shader reads to reinitialize any dead particles outward from that point in an evenly-spread radial burst. Controls exposed to 
the user include trail length, particle size, launch frequency, death rate, and speed.
