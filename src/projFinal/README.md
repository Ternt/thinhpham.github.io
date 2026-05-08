At the beginning I wanted to do a 3D fog fluid simulation similar to the one seen [here](https://www.youtube.com/watch?v=8ZTmDa9cN60). 
So the aesthetic choice I had in mind was a spaceship scene, similar to the one in  the game Alien Isolation. The scene would be a 
medium-sized round, room with a smoke emitter at the middle. The emitter would spew out smoke that would rise to the ceiling. The 
room would also have strobe lights that would periodically pulse to highlight the volumetric nature of the fog. But in order to do 
this, I had to start from scratch and create the literal universe. In the end, I opted for a clustered forward renderer.

Clustered forward rendering is a technique that divides the camera frustum into a 3D grid of sub-volumes called clusters, my 
implementation uses a 16×9×24 cluster grid, in total 3,456 grid cells. The rendering is split up into many stages. The first 
stage is the Cluster bounds compute pass which compute AABB for each cluster in view space. For each cluster, the shader 
computes a view-space AABB (axis-aligned bounding box) by:

- 1. Converting the tile's screen-space corners to view-space rays using inv_proj. 
- 2. Intersecting those rays with the near and far Z planes of the cluster slice using line_intersection_z.
- 3. Taking the min/max of those four intersection points to form the AABB.

The result is 3,456 view-space boxes stored in clusterBuf, each describing exactly what region of 3D space that cluster covers.
The second is a Light assignment compute pass that test each light against each cluster and writes a light list. One compute thread 
per cluster. For each cluster it loops over every light and does a sphere aabb intersection test between the cluster and the light
radius. If yes, the light index gets appended to light_list at a pre-allocated offset for that cluster, and the count in light_grid 
is incremented.

Finally the render pass, which looks up its cluster, iterates thorugh only the lights that are visible and compute the total light 
accumulation. Each fragment first determines which cluster it belongs to using cluster_index(). This gives a flat integer index into 
light_grid. The fragment then looks up {offset, count} for its cluster and only iterates over those lights. The lighting model itself 
is a simple diffuse Lambertian term (NdotL) multiplied by the light color, base color, and attenuation. The attenuation uses a 
constant-linear-quadratic falloff with a smoothstep fade in the outer 30% of the radius to avoid the hard cutoff artifact. 
This model was based on the model [here](https://developer.valvesoftware.com/wiki/Constant-Linear-Quadratic_Falloff).

Building this required writing the full WebGPU pipeline by hand: buffer management, bind group layouts, a depth pass, 
the cluster subdivision compute shader, the light assignment compute shader, and finally the geometry render pass that consumes all 
of it. I also implemented a GLTF/GLB model loader to bring in external geometry, a scene graph with world matrix propagation, a kinematic 
character controller using the Rapier physics library for first-person navigation, and an emissive light extraction system that 
automatically generates point lights from emissive mesh materials in the loaded model.

