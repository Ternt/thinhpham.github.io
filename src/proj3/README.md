The aesthetic inspiration for this project was Return of the Obra Dinn, Lucas Pope's game known for its 
stark black and white dithered visual style. I wanted to capture a similar high-contrast, graphic quality, 
though the theory behind full dithering proved too involved so I opted for edge detection instead. 

The algorithm I landed on was Sobel's and Prewitt's Operator. At a high level, both work by sampling a 3×3 
grid of neighboring pixels around each fragment and applying two directional convolution kernels - one 
detecting horizontal edges (Gx) and one detecting vertical edges (Gy) - then combining the results as 
sqrt(Gx² + Gy²) to get a single edge strength value. Sobel weights the center row and column more heavily 
than the corners, giving it slightly smoother results, while Prewitt treats all neighbors equally. I 
implemented a single greyscale edge value version, and a per-channel convolution matrix version that 
preserves color information in the gradient.

Interaction mechanisms:
Video
Mouse
Dropdown (adjust algorithm)
