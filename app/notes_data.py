"""Hand-written study notes for the core IFT 211 concepts.

Each entry: (three key points, one worked example, one common trap).
Concepts not listed here get notes written by the AI (saved into the graph) or, without an API key,
notes built from the graph itself (what the topic builds on and what it unlocks).
"""

NOTES = {
    "number_systems": (
        ["A number system has a base: how many digits it uses (decimal 10, binary 2, hex 16).",
         "Each position is worth base^position, counting from 0 on the right.",
         "The same value can be written in any base; only the notation changes."],
        "352 in base 10 = 3x100 + 5x10 + 2x1.",
        "Forgetting the rightmost position is base^0 = 1, not base^1."),
    "binary": (
        ["Binary uses only 0 and 1; each digit is a bit.",
         "Place values double from the right: 1, 2, 4, 8, 16...",
         "n bits can represent 2^n different values (0 to 2^n - 1)."],
        "1101 = 8 + 4 + 0 + 1 = 13.",
        "Reading place values from the left instead of the right."),
    "hex_octal": (
        ["Octal groups bits in threes, hex groups bits in fours.",
         "Hex digits go 0-9 then A-F (A = 10, F = 15).",
         "They are shorthand for long binary strings, not new maths."],
        "1011 1110 in binary = BE in hex.",
        "Grouping from the left; always group from the binary point outwards."),
    "base_conversion": (
        ["Decimal to binary: divide by 2 repeatedly, read remainders bottom to top.",
         "Binary to decimal: add the place values of the 1 bits.",
         "Binary to hex or octal: group bits in fours or threes from the right."],
        "13 / 2 gives remainders 1, 0, 1, 1, so 13 = 1101.",
        "Reading the remainders top to bottom gives the number backwards."),
    "binary_arithmetic": (
        ["1 + 1 = 10 in binary: write 0, carry 1.",
         "1 + 1 + 1 = 11: write 1, carry 1.",
         "Subtraction borrows 2 (not 10) from the next column."],
        "0111 + 0011 = 1010 (7 + 3 = 10).",
        "Dropping the final carry when the answer needs an extra bit."),
    "signed_numbers": (
        ["Sign-magnitude: first bit is the sign, the rest is the size.",
         "One's complement: flip every bit to negate.",
         "Both have two zeros (+0 and -0), which is why two's complement won."],
        "In 4-bit sign-magnitude, -3 = 1011.",
        "Assuming the first bit is just another place value in a signed number."),
    "twos_complement": (
        ["To negate: invert every bit, then add 1.",
         "The leftmost bit has a negative weight (-8 in 4 bits).",
         "Range for n bits: -2^(n-1) to 2^(n-1) - 1."],
        "-5 in 4 bits: 0101 -> 1010 -> 1011.",
        "Forgetting the +1 after inverting gives one's complement instead."),
    "bcd_codes": (
        ["BCD stores each decimal digit as its own 4-bit group.",
         "Only 0000 to 1001 are valid; 1010 to 1111 are unused.",
         "Easy to show on displays, wasteful for arithmetic."],
        "47 in BCD = 0100 0111 (not the binary of 47).",
        "Converting the whole number to binary instead of digit by digit."),
    "gray_code": (
        ["Neighbouring values differ in exactly one bit.",
         "Binary to Gray: keep the first bit, then XOR each bit with the one before it.",
         "K-map rows and columns use Gray order so adjacent cells differ by one variable."],
        "2-bit Gray sequence: 00, 01, 11, 10.",
        "Labelling K-map columns 00, 01, 10, 11 (binary order) breaks the grouping."),
    "logic_gates": (
        ["AND outputs 1 only when all inputs are 1.",
         "OR outputs 1 when any input is 1.",
         "NOT flips its single input."],
        "A = 1, B = 0: AND gives 0, OR gives 1, NOT A gives 0.",
        "Mixing up the AND (flat back) and OR (curved back) symbols."),
    "xor_xnor": (
        ["XOR outputs 1 when the inputs are different.",
         "XNOR outputs 1 when the inputs are the same.",
         "XOR is the sum bit of binary addition."],
        "1 XOR 1 = 0, 1 XOR 0 = 1.",
        "Treating XOR like OR: they differ only when both inputs are 1."),
    "truth_tables": (
        ["List every input combination: n inputs means 2^n rows.",
         "Count the inputs in binary order so you never miss a row.",
         "One output column per output you care about."],
        "A 3-input table has 8 rows, 000 to 111.",
        "Skipping rows by writing combinations in a random order."),
    "boolean_algebra": (
        ["+ means OR, a dot (or nothing) means AND, a bar or ' means NOT.",
         "AND is done before OR, like multiplication before addition.",
         "Every gate circuit has a matching expression, and the reverse."],
        "Y = A·B + C' means (A AND B) OR (NOT C).",
        "Reading A + B·C as (A + B)·C."),
    "boolean_laws": (
        ["Identity: A + 0 = A, A·1 = A. Null: A + 1 = 1, A·0 = 0.",
         "Complement: A + A' = 1, A·A' = 0. Idempotent: A + A = A.",
         "Absorption: A + A·B = A, and A·(A + B) = A."],
        "A·B + A·B' = A·(B + B') = A·1 = A.",
        "Using ordinary algebra: in Boolean, A + A = A, not 2A."),
    "de_morgan": (
        ["(A·B)' = A' + B': break the bar, change AND to OR.",
         "(A + B)' = A'·B': break the bar, change OR to AND.",
         "It is why NAND = OR with inverted inputs, and NOR = AND with inverted inputs."],
        "(A·B·C)' = A' + B' + C'.",
        "Inverting the inputs but forgetting to swap the operator."),
    "universal_gates": (
        ["NAND alone can build NOT, AND and OR, so it can build anything. So can NOR.",
         "NOT from NAND: tie both inputs together.",
         "AND from NAND: a NAND followed by a NAND-as-NOT."],
        "OR from NANDs: invert A and B with NANDs, then NAND the results (De Morgan).",
        "Forgetting the extra inverter stage when building AND or OR."),
    "canonical_forms": (
        ["SOP: OR together AND terms, one term per row where the output is 1.",
         "POS: AND together OR terms, one term per row where the output is 0.",
         "Canonical means every term contains every variable."],
        "Output 1 on rows 01 and 10: Y = A'B + AB'.",
        "Building POS terms from the 1 rows instead of the 0 rows."),
    "minterms_maxterms": (
        ["A minterm is an AND term that is 1 for exactly one row.",
         "A maxterm is an OR term that is 0 for exactly one row.",
         "Sigma notation lists minterm row numbers, Pi notation lists maxterms."],
        "Y = Σm(1, 2) is the same function as Y = ΠM(0, 3) for 2 inputs.",
        "In a maxterm, a 0 input appears uncomplemented (opposite of minterms)."),
    "kmaps": (
        ["Rows and columns follow Gray order, so neighbours differ by one variable.",
         "Group 1s in rectangles of 1, 2, 4, 8 cells; bigger groups mean simpler terms.",
         "Edges wrap around, and groups may overlap."],
        "A group of 4 in a 4-variable map leaves a 2-variable term.",
        "Making a group of 3 or 6; sizes must be powers of two."),
    "gate_minimization": (
        ["Fewer terms and fewer literals means fewer gates.",
         "Use Boolean laws or K-maps to remove redundant terms.",
         "Check the simplified form against the truth table."],
        "AB + AB' + A'B simplifies to A + B.",
        "Stopping early: always look for a bigger K-map group."),
    "combinational_design": (
        ["Read the problem, name inputs and outputs.",
         "Fill the truth table, simplify each output, then draw gates.",
         "Output depends only on current inputs, never on the past."],
        "Majority of 3 voters: Y = AB + AC + BC.",
        "Jumping to gates before the truth table is complete."),
    "full_adder": (
        ["Adds A, B and a carry-in.",
         "Sum = A XOR B XOR Cin.",
         "Cout = AB + Cin(A XOR B)."],
        "1 + 1 + 1: Sum 1, Carry 1.",
        "Using a half adder where there is a carry coming in."),
    "subtractor": (
        ["A - B = A + (two's complement of B).",
         "Invert B with XOR gates and set the first carry-in to 1.",
         "One adder circuit can then add or subtract."],
        "5 - 3: 0101 + 1101 = 1 0010, drop the carry: 0010 = 2.",
        "Forgetting the carry-in of 1 (that is the +1 of two's complement)."),
    "sequential_intro": (
        ["Sequential circuits remember: output depends on inputs and stored state.",
         "Memory comes from feedback: an output wired back to an input.",
         "Latches and flip-flops are the basic memory cells."],
        "A light switch remembers on or off after you let go; a doorbell does not.",
        "Analysing a feedback loop like a combinational circuit."),
    "timing_diagrams": (
        ["Time runs left to right; each signal is a row.",
         "High is 1, low is 0; read every output at each input change.",
         "Line up rising or falling clock edges with vertical guides."],
        "For Y = A AND B, Y is high only where both A and B rows are high.",
        "Reading outputs between edges for edge-triggered parts."),
    "clock_signals": (
        ["A clock is a square wave that tells circuits when to update.",
         "Rising edge is 0 to 1, falling edge is 1 to 0.",
         "Edge-triggered parts change only at the edge, not while the clock is high."],
        "A 1 kHz clock ticks 1000 times a second (period 1 ms).",
        "Mixing level-triggered (latch) and edge-triggered (flip-flop) behaviour."),
    "sr_latch": (
        ["Two cross-coupled NOR (or NAND) gates store one bit.",
         "S = 1 sets Q to 1, R = 1 resets Q to 0, both 0 holds.",
         "S = R = 1 is forbidden in the NOR version."],
        "Pulse S high: Q becomes 1 and stays 1 after S goes back to 0.",
        "Forgetting the NAND version is active-low (S' and R')."),
    "d_latch": (
        ["Adds an enable input and ties R to NOT D, so S and R are never both 1.",
         "Enable high: Q follows D (transparent).",
         "Enable low: Q holds the last D."],
        "D = 1 while enable is high, then enable drops: Q stays 1.",
        "Expecting it to change only on an edge; a latch follows D the whole time enable is high."),
    "flip_flops": (
        ["A flip-flop stores one bit and changes only on a clock edge.",
         "Built from two latches in a row (master and slave).",
         "Types: D, JK and T, each with its own input rules."],
        "D flip-flop: on each rising edge, Q takes the value of D.",
        "Confusing latches (level-sensitive) with flip-flops (edge-triggered)."),
    "jk_flip_flop": (
        ["J = 1, K = 0 sets. J = 0, K = 1 resets. Both 0 holds.",
         "J = K = 1 toggles: the case the SR latch could not handle.",
         "Q(next) = JQ' + K'Q."],
        "Q = 0, J = K = 1, clock edge: Q becomes 1.",
        "Treating J = K = 1 as forbidden; that was the SR latch."),
    "t_flip_flop": (
        ["T = 1 toggles on each clock edge, T = 0 holds.",
         "Q(next) = T XOR Q.",
         "Chains of T flip-flops make counters."],
        "T = 1 for 4 edges starting at Q = 0: Q goes 1, 0, 1, 0.",
        "Expecting it to set or reset; it only toggles or holds."),
    "excitation_tables": (
        ["Answers: what inputs do I need to move from Q to Q(next)?",
         "Used when designing counters and state machines.",
         "X means don't care: either value works."],
        "JK, Q 0 to 1: J = 1, K = X.",
        "Using the characteristic table (what happens) instead of the excitation table (what to apply)."),
}
