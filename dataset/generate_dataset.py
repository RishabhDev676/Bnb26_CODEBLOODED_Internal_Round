import json
import os

# Comprehensive dataset of programming misconceptions, explanations, interventions, and fixes
DATASET = [
    # 1. Assignment vs Equality
    {
        "problem": "Write a function is_even(n) returning True if n is even, False otherwise.",
        "language": "python",
        "student_code": "def is_even(n):\n    if n % 2 = 0:\n        return True\n    return False",
        "is_correct": False,
        "misconception": "Assignment operator '=' used in comparison context",
        "explanation": "In Python, a single '=' assigns a value to a variable, whereas '==' compares two values. Inside 'if n % 2 = 0:', Python encounters a syntax error because it expects a boolean expression, not an assignment statement.",
        "intervention": "Notice the difference between creating a variable and checking its value. How do you test equality in an if condition?",
        "fixed_code": "def is_even(n):\n    if n % 2 == 0:\n        return True\n    return False"
    },
    {
        "problem": "Check if a user is an adult (age >= 18).",
        "language": "python",
        "student_code": "def check_adult(age):\n    if age = 18:\n        return 'Just adult'\n    elif age > 18:\n        return 'Adult'\n    return 'Minor'",
        "is_correct": False,
        "misconception": "Assignment operator '=' used in comparison context",
        "explanation": "Using '=' inside 'if age = 18' attempts an assignment inside a conditional check, raising a SyntaxError.",
        "intervention": "Recall how equality checks are written in Python comparison expressions.",
        "fixed_code": "def check_adult(age):\n    if age == 18:\n        return 'Just adult'\n    elif age > 18:\n        return 'Adult'\n    return 'Minor'"
    },
    {
        "problem": "Check if count has reached the target 10 in a while loop.",
        "language": "python",
        "student_code": "count = 0\nwhile count = 10:\n    print(count)\n    count += 1",
        "is_correct": False,
        "misconception": "Assignment operator '=' used in comparison context",
        "explanation": "The while loop condition 'count = 10' performs an illegal assignment instead of testing whether count has reached 10.",
        "intervention": "Use comparative equality '==' or inequality '<' to evaluate loop conditions.",
        "fixed_code": "count = 0\nwhile count < 10:\n    print(count)\n    count += 1"
    },

    # 2. Correct Even / Comparisons
    {
        "problem": "Write a function is_even(n) returning True if n is even, False otherwise.",
        "language": "python",
        "student_code": "def is_even(n):\n    return n % 2 == 0",
        "is_correct": True,
        "misconception": "None",
        "explanation": "The solution correctly evaluates whether dividing n by 2 leaves a remainder of 0 using comparative equality.",
        "intervention": "Great work! The comparison expression directly evaluates to a boolean.",
        "fixed_code": "def is_even(n):\n    return n % 2 == 0"
    },
    {
        "problem": "Write a function is_even(n) returning True if n is even, False otherwise using bitwise operators.",
        "language": "python",
        "student_code": "def is_even(n):\n    return (n & 1) == 0",
        "is_correct": True,
        "misconception": "None",
        "explanation": "The bitwise AND with 1 checks the least significant bit: even numbers end with 0, so (n & 1) == 0 evaluates to True.",
        "intervention": "Excellent use of low-level bitwise arithmetic for an optimal check.",
        "fixed_code": "def is_even(n):\n    return (n & 1) == 0"
    },

    # 3. Inverted Truthiness Logic
    {
        "problem": "Write a function is_even(n) returning True if n is even, False otherwise.",
        "language": "python",
        "student_code": "def is_even(n):\n    if n % 2:\n        return True\n    return False",
        "is_correct": False,
        "misconception": "Truthy remainder inverted logic",
        "explanation": "In Python, non-zero integers evaluate to True. When n is odd, n % 2 is 1 (True); when n is even, n % 2 is 0 (False). This function inverts the logic and returns True for odd numbers.",
        "intervention": "What is the numerical remainder of 4 % 2 vs 5 % 2? In Python, does 0 evaluate to True or False in an if condition?",
        "fixed_code": "def is_even(n):\n    if not (n % 2):\n        return True\n    return False"
    },
    {
        "problem": "Check if a list has elements before accessing the first item.",
        "language": "python",
        "student_code": "def get_first(items):\n    if len(items) == False:\n        return None\n    return items[0]",
        "is_correct": False,
        "misconception": "Equating length 0 with boolean False literal",
        "explanation": "While 0 is falsy, comparing len(items) == False is bad practice and confusing. Python lists can be tested directly with 'if not items:'.",
        "intervention": "How does Python evaluate empty sequences directly in boolean expressions?",
        "fixed_code": "def get_first(items):\n    if not items:\n        return None\n    return items[0]"
    },

    # 4. Mutable Default Argument Trap
    {
        "problem": "Write a function append_item(val, container=[]) that adds val to container.",
        "language": "python",
        "student_code": "def append_item(val, container=[]):\n    container.append(val)\n    return container",
        "is_correct": False,
        "misconception": "Mutable default argument state retention",
        "explanation": "In Python, default arguments are created once when the function is defined, not on each call. Passing a mutable list [] causes all invocations without an explicit container to share and mutate the exact same list instance.",
        "intervention": "What happens if you call append_item(1) and then append_item(2) without passing a list? How can you use None as a default sentinel?",
        "fixed_code": "def append_item(val, container=None):\n    if container is None:\n        container = []\n    container.append(val)\n    return container"
    },
    {
        "problem": "Create a function register_student(name, grades={}) storing student grades.",
        "language": "python",
        "student_code": "def register_student(name, grades={}):\n    grades[name] = []\n    return grades",
        "is_correct": False,
        "misconception": "Mutable dictionary default argument",
        "explanation": "Using a mutable dictionary '{}' as a default argument means every caller shares the same dictionary object in memory across calls.",
        "intervention": "Use None as the default value and initialize a new dictionary inside the function body if it is None.",
        "fixed_code": "def register_student(name, grades=None):\n    if grades is None:\n        grades = {}\n    grades[name] = []\n    return grades"
    },

    # 5. Off-by-one / IndexError Loop Traversals
    {
        "problem": "Find the maximum element in a list of numbers.",
        "language": "python",
        "student_code": "def find_max(numbers):\n    max_val = numbers[0]\n    for i in range(1, len(numbers) + 1):\n        if numbers[i] > max_val:\n            max_val = numbers[i]\n    return max_val",
        "is_correct": False,
        "misconception": "Index out of bounds / range upper bound inclusive assumption",
        "explanation": "Python lists are 0-indexed with valid indices from 0 to len(numbers) - 1. Using range(1, len(numbers) + 1) attempts to access numbers[len(numbers)], which raises an IndexError.",
        "intervention": "What is the highest valid index of a list containing 3 elements? What is the final value produced by range(1, 4)?",
        "fixed_code": "def find_max(numbers):\n    max_val = numbers[0]\n    for i in range(1, len(numbers)):\n        if numbers[i] > max_val:\n            max_val = numbers[i]\n    return max_val"
    },
    {
        "problem": "Reverse an array in JavaScript.",
        "language": "javascript",
        "student_code": "function reverseArray(arr) {\n    let result = [];\n    for (let i = arr.length; i >= 0; i--) {\n        result.push(arr[i]);\n    }\n    return result;\n}",
        "is_correct": False,
        "misconception": "Index out of bounds at arr.length in JavaScript",
        "explanation": "Starting at arr.length pushes undefined because the last valid index of an array of length N is N - 1.",
        "intervention": "What is the index of the last element in an array of 5 items? Where should the reverse loop start?",
        "fixed_code": "function reverseArray(arr) {\n    let result = [];\n    for (let i = arr.length - 1; i >= 0; i--) {\n        result.push(arr[i]);\n    }\n    return result;\n}"
    },

    # 6. JavaScript Loose Equality & Type Coercion
    {
        "problem": "Write a function isValidToken(role, tier) verifying role is 'admin' and tier is integer 1.",
        "language": "javascript",
        "student_code": "function isValidToken(role, tier) {\n    if (role == 'admin' && tier == 1) {\n        return true;\n    }\n    return false;\n}",
        "is_correct": False,
        "misconception": "Loose equality (==) allows implicit type coercion",
        "explanation": "The loose equality operator '==' converts operands to common types before comparing. Passing tier = '1' or tier = true evaluates to true, bypassing security checks.",
        "intervention": "Which JavaScript operator checks both the value AND the data type without performing type coercion?",
        "fixed_code": "function isValidToken(role, tier) {\n    return role === 'admin' && tier === 1;\n}"
    },
    {
        "problem": "Check if a value is strictly boolean false, not falsy 0 or empty string.",
        "language": "javascript",
        "student_code": "function isStrictFalse(val) {\n    return val == false;\n}",
        "is_correct": False,
        "misconception": "Loose equality equates 0 and '' with false",
        "explanation": "In JavaScript, 0 == false and '' == false both evaluate to true because loose equality coerces types. To check only literal false, strict equality (===) is required.",
        "intervention": "Try comparing 0 === false in the browser console. What does strict identity return?",
        "fixed_code": "function isStrictFalse(val) {\n    return val === false;\n}"
    },

    # 7. Variable Scope & Modification (UnboundLocalError / Global)
    {
        "problem": "Increment a counter tracked outside the function.",
        "language": "python",
        "student_code": "total = 0\ndef add_to_total(amount):\n    total += amount\n    return total",
        "is_correct": False,
        "misconception": "Local assignment shadowing without global/nonlocal declaration",
        "explanation": "In Python, assigning to 'total' inside a function makes 'total' a local variable for that scope. Because it is read before assignment on the right-hand side of 'total += amount', Python raises an UnboundLocalError.",
        "intervention": "If a function modifies a variable defined in the outer global scope, what keyword informs Python to use the outer binding?",
        "fixed_code": "total = 0\ndef add_to_total(amount):\n    global total\n    total += amount\n    return total"
    },

    # 8. String vs Integer Concatenation
    {
        "problem": "Add two numbers entered as user input strings.",
        "language": "python",
        "student_code": "def add_inputs(a, b):\n    return a + b\n# where a = '5' and b = '10'",
        "is_correct": False,
        "misconception": "String concatenation vs numeric addition",
        "explanation": "In Python, '+' between strings concatenates them ('5' + '10' = '510') rather than performing mathematical addition (15).",
        "intervention": "What function converts a string representation of digits into an integer or float?",
        "fixed_code": "def add_inputs(a, b):\n    return int(a) + int(b)"
    },

    # 9. Shallow Copy vs Deep Copy Mutation
    {
        "problem": "Duplicate a 2D matrix without modifying the original.",
        "language": "python",
        "student_code": "def duplicate_grid(grid):\n    new_grid = list(grid)\n    new_grid[0][0] = 999\n    return new_grid",
        "is_correct": False,
        "misconception": "Shallow copy mutates nested sublists",
        "explanation": "Using list(grid) or grid[:] creates a shallow copy. The outer list is new, but its inner sublists still point to the exact same objects in memory, mutating the original grid.",
        "intervention": "What module in Python provides 'deepcopy()' to recursively clone nested structures?",
        "fixed_code": "import copy\ndef duplicate_grid(grid):\n    new_grid = copy.deepcopy(grid)\n    new_grid[0][0] = 999\n    return new_grid"
    },

    # 10. Missing Return Statement in Recursive or Helper Function
    {
        "problem": "Calculate factorial of n recursively.",
        "language": "python",
        "student_code": "def factorial(n):\n    if n <= 1:\n        return 1\n    factorial(n - 1) * n",
        "is_correct": False,
        "misconception": "Omitted return keyword in recursive step",
        "explanation": "The recursive expression 'factorial(n - 1) * n' is calculated, but because the 'return' statement was omitted, the function implicitly returns None.",
        "intervention": "Every recursive branch must pass its computed value back up the call stack. What keyword is missing on line 4?",
        "fixed_code": "def factorial(n):\n    if n <= 1:\n        return 1\n    return factorial(n - 1) * n"
    },

    # 11. Division by Zero & Boundary Cases
    {
        "problem": "Calculate the average of a list of numbers.",
        "language": "python",
        "student_code": "def calculate_average(nums):\n    return sum(nums) / len(nums)",
        "is_correct": False,
        "misconception": "Unchecked zero-division on empty input",
        "explanation": "When 'nums' is an empty list, len(nums) is 0, causing Python to raise a ZeroDivisionError.",
        "intervention": "What edge case occurs if the input list is empty? How can you guard against dividing by zero?",
        "fixed_code": "def calculate_average(nums):\n    if not nums:\n        return 0\n    return sum(nums) / len(nums)"
    },

    # 12. Correct String Concatenation & Formats
    {
        "problem": "Format a greeting message with user's name and age.",
        "language": "python",
        "student_code": "def greet(name, age):\n    return f'Hello {name}, you are {age} years old.'",
        "is_correct": True,
        "misconception": "None",
        "explanation": "Uses modern Python f-string formatting to safely interpolate variables into the string.",
        "intervention": "Great job! F-strings are both concise and readable.",
        "fixed_code": "def greet(name, age):\n    return f'Hello {name}, you are {age} years old.'"
    }
]

def save_datasets():
    os.makedirs('dataset', exist_ok=True)
    with open('dataset/misconceptions_dataset.json', 'w') as f:
        json.dump(DATASET, f, indent=2)
    print(f"Saved {len(DATASET)} sample dataset entries to dataset/misconceptions_dataset.json")

if __name__ == '__main__':
    save_datasets()
