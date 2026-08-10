def square(n):
    return n * n

import sys
input_val = sys.stdin.read().strip()
if input_val:
    print(square(int(input_val)))
