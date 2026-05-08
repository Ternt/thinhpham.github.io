For this project, I built a rule system where each vant type is defined by a makeVant() function that accepts an array of rule objects, 
each specifying which pheromone value to react to, how much to turn, and what pheromone value to stamp onto the current cell 
before moving on. Rules are evaluated in order and the first match wins, which means complex multi-state behaviours can be 
composed by chaining rules. I had three presets: the classic Langton variant which turns right on empty cells and 
left on marked ones, a reversed variant that does the opposite, and a symmetric variant that always turns a smaller increment 
in the same direction, producing slower and more organic-looking trails. Second, I built a chunk system that groups three vants 
into a cluster spawned near a shared center point, with each individual vant given a small positional offset and an independently 
chosen ruleset and color.

The behavioural goal behind the chunk system was the hope that placing different vant types in close proximity would cause their pheromone trails to interact. 
By scattering four chunks across the screen in different configurations of the three vant types, I was aiming for situations where the patterns grown by each 
cluster would eventually collide and interfere with each other, producing emergent structure that none of the individual vants could generate alone.
