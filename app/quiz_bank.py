"""Hand-written questions for the concepts the demo students are most likely to hit.

Anything not listed here gets a quiz generated from the graph (see services.graph_quiz).
Each question: prompt, 4 options, index of the correct option, one-line why.
"""

BANK = {
    "de_morgan": [
        ("By De Morgan, NOT(A AND B) equals...", ["NOT A AND NOT B", "NOT A OR NOT B", "A OR B", "NOT(A OR B)"], 1,
         "Break the bar, change the sign: AND becomes OR and each input gets inverted."),
        ("NOT(A OR B) is the same as...", ["NOT A AND NOT B", "NOT A OR NOT B", "A AND B", "A NOR B NOR A"], 0,
         "OR flips to AND, and both inputs are inverted."),
        ("A NAND gate behaves like which gate with inverted inputs?", ["AND", "XOR", "OR", "NOR"], 2,
         "NAND = NOT(A AND B) = NOT A OR NOT B, an OR with inverted inputs."),
    ],
    "universal_gates": [
        ("Why are NAND and NOR called universal gates?", ["They are the fastest gates", "Any logic function can be built from just one of them", "They use no power", "They have three inputs"], 1,
         "With only NANDs (or only NORs) you can build NOT, AND and OR, so anything."),
        ("Tie both inputs of a NAND gate together. What do you get?", ["AND", "Buffer", "OR", "NOT"], 3,
         "NAND(A, A) = NOT(A AND A) = NOT A."),
        ("A NOR gate outputs 1 when...", ["Both inputs are 0", "Either input is 1", "Inputs differ", "Both inputs are 1"], 0,
         "NOR is NOT OR: only 0 OR 0 gives 0, which NOR flips to 1."),
    ],
    "sr_latch": [
        ("In a NOR-based SR latch, S=1 and R=0 makes Q...", ["0", "1", "Toggle", "Stay the same"], 1,
         "S means Set, so Q becomes 1."),
        ("Which input pair is forbidden in a NOR SR latch?", ["S=0, R=0", "S=1, R=0", "S=0, R=1", "S=1, R=1"], 3,
         "Both Q and Q-bar are forced to 0, and the next state is unpredictable."),
        ("With S=0 and R=0 the latch...", ["Resets", "Sets", "Holds its last value", "Oscillates"], 2,
         "No set, no reset: the feedback loop keeps the stored bit."),
    ],
    "d_latch": [
        ("A D latch fixes the SR latch's problem by...", ["Adding a clock edge", "Making S and R always opposite", "Removing feedback", "Using XOR gates"], 1,
         "S = D and R = NOT D, so the forbidden S=R=1 can never happen."),
        ("While enable is high, a D latch output...", ["Follows D", "Holds", "Toggles", "Is always 0"], 0,
         "It is transparent: Q copies D while enabled."),
        ("When enable goes low, a D latch...", ["Resets to 0", "Follows D", "Keeps the last value of D", "Inverts D"], 2,
         "It latches whatever D was at the moment enable dropped."),
    ],
    "boolean_laws": [
        ("Simplify A + A·B", ["A·B", "B", "A", "A + B"], 2,
         "Absorption: if A is 1 the whole thing is 1; if A is 0 so is A·B."),
        ("A · (A + B) simplifies to...", ["A", "A·B", "B", "1"], 0,
         "Absorption again, the AND version."),
        ("A + NOT A equals...", ["0", "A", "NOT A", "1"], 3,
         "Complement law: one of them is always 1."),
    ],
    "gray_code": [
        ("What makes Gray code special?", ["It uses fewer bits", "Neighbouring values differ by exactly one bit", "It is base 3", "It has a parity bit"], 1,
         "Only one bit changes per step, so no glitchy in-between values."),
        ("Gray code for decimal 2 (2 bits) is...", ["10", "01", "11", "00"], 2,
         "Sequence is 00, 01, 11, 10, so 2 is 11."),
        ("Why are K-map rows and columns labelled in Gray code order?", ["To save space", "So adjacent cells differ by one variable", "Because binary is wrong", "To make it alphabetical"], 1,
         "Adjacent cells must differ in one variable so groups simplify."),
    ],
    "kmaps": [
        ("In a K-map, groups must contain how many cells?", ["Any number", "A power of two", "An odd number", "Exactly four"], 1,
         "1, 2, 4, 8... only powers of two remove whole variables."),
        ("A group of 4 cells in a 4-variable K-map removes how many variables?", ["1", "3", "4", "2"], 3,
         "4 = 2 squared, so 2 variables drop out."),
        ("Can a K-map group wrap around the edges?", ["Yes, edges are adjacent", "No, never", "Only on 2-variable maps", "Only diagonally"], 0,
         "Left and right (and top and bottom) edges are neighbours in Gray order."),
    ],
    "flip_flops": [
        ("What is the key difference between a latch and a flip-flop?", ["Flip-flops have no feedback", "Flip-flops change only on a clock edge", "Latches store two bits", "Latches need a clock edge"], 1,
         "Latches are level-sensitive; flip-flops are edge-triggered."),
        ("How many bits does one flip-flop store?", ["1", "2", "4", "8"], 0,
         "One flip-flop, one bit."),
        ("A JK flip-flop with J=1 and K=1 will...", ["Reset", "Set", "Toggle", "Hold"], 2,
         "J=K=1 is the toggle case, which the SR latch could not do."),
    ],
    "base_conversion": [
        ("Binary 1011 in decimal is...", ["9", "13", "11", "10"], 2,
         "8 + 0 + 2 + 1 = 11."),
        ("Hex F equals binary...", ["1111", "1000", "1110", "0111"], 0,
         "F = 15 = 8 + 4 + 2 + 1."),
        ("Decimal 6 in binary is...", ["101", "111", "011", "110"], 3,
         "6 = 4 + 2, so 110."),
    ],
    "twos_complement": [
        ("To get the two's complement of a number you...", ["Add 1 only", "Invert every bit, then add 1", "Reverse the bits", "Invert the first bit"], 1,
         "Flip all bits, then add 1."),
        ("In 4-bit two's complement, 1111 means...", ["15", "-1", "-7", "-8"], 1,
         "It is the two's complement of 0001, so -1."),
        ("The range of 4-bit two's complement is...", ["-8 to 7", "-7 to 7", "0 to 15", "-16 to 15"], 0,
         "One extra negative value: -8 up to +7."),
    ],
}
