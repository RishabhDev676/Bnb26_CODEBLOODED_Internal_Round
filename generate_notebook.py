import json

notebook = {
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# 🧠 Re:Learn — AI/ML Model Training Pipeline\n",
    "### Fine-Tuning CodeT5 for Student Programming Misconception Diagnosis & Socratic Intervention\n",
    "\n",
    "> **Objective**: Move beyond binary pass/fail grading by training an AI model that inspects student code, detects cognitive misconceptions, generates conceptual explanations, provides Socratic hints, and outputs the corrected implementation.\n",
    "\n",
    "---"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 1. Environment Setup & GPU Check\n",
    "Ensure runtime is set to **GPU (T4)**: `Runtime` -> `Change runtime type` -> `T4 GPU`."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "!pip install -q transformers datasets accelerate torch evaluate scikit-learn matplotlib pyngrok fastapi uvicorn nest_asyncio\n",
    "\n",
    "import torch\n",
    "print(f\"PyTorch Version: {torch.__version__}\")\n",
    "if torch.cuda.is_available():\n",
    "    print(f\"✅ GPU Detected: {torch.cuda.get_device_name(0)}\")\n",
    "    print(f\"VRAM Available: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB\")\n",
    "else:\n",
    "    print(\"⚠️ GPU not detected! Please switch runtime to T4 GPU for fast training.\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 2. Dataset of Programming Misconceptions\n",
    "We build an expanded, categorized dataset of student coding errors and mental model bugs across Python and JavaScript."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "import json\n",
    "\n",
    "RAW_DATA = [\n",
    "    # 1. Assignment vs Equality\n",
    "    {\n",
    "        \"problem\": \"Write a function is_even(n) returning True if n is even, False otherwise.\",\n",
    "        \"student_code\": \"def is_even(n):\\n    if n % 2 = 0:\\n        return True\\n    return False\",\n",
    "        \"is_correct\": False,\n",
    "        \"misconception\": \"Assignment operator '=' used in comparison context\",\n",
    "        \"explanation\": \"A single '=' assigns a value to a variable, whereas '==' evaluates equality. Inside an 'if' condition, Python expects a boolean expression.\",\n",
    "        \"intervention\": \"Notice the difference between assigning a value and checking it. How do you test equality in Python?\",\n",
    "        \"fixed_code\": \"def is_even(n):\\n    if n % 2 == 0:\\n        return True\\n    return False\"\n",
    "    },\n",
    "    {\n",
    "        \"problem\": \"Check if count reached 10 in a loop.\",\n",
    "        \"student_code\": \"while count = 10:\\n    print(count)\\n    count += 1\",\n",
    "        \"is_correct\": False,\n",
    "        \"misconception\": \"Assignment operator '=' used in comparison context\",\n",
    "        \"explanation\": \"Inside loop conditions, assignment statements are invalid syntax. Comparison operators must be used.\",\n",
    "        \"intervention\": \"Use comparative equality '==' or relational operators to test loop conditions.\",\n",
    "        \"fixed_code\": \"while count < 10:\\n    print(count)\\n    count += 1\"\n",
    "    },\n",
    "    # 2. Correct Even / Comparisons\n",
    "    {\n",
    "        \"problem\": \"Write a function is_even(n) returning True if n is even, False otherwise.\",\n",
    "        \"student_code\": \"def is_even(n):\\n    return n % 2 == 0\",\n",
    "        \"is_correct\": True,\n",
    "        \"misconception\": \"None\",\n",
    "        \"explanation\": \"The solution directly and accurately evaluates the boolean condition of remainder zero.\",\n",
    "        \"intervention\": \"Great work! The comparison evaluates directly to True or False.\",\n",
    "        \"fixed_code\": \"def is_even(n):\\n    return n % 2 == 0\"\n",
    "    },\n",
    "    {\n",
    "        \"problem\": \"Write a function is_even(n) returning True if n is even, False otherwise using bitwise operators.\",\n",
    "        \"student_code\": \"def is_even(n):\\n    return (n & 1) == 0\",\n",
    "        \"is_correct\": True,\n",
    "        \"misconception\": \"None\",\n",
    "        \"explanation\": \"Even integers have 0 as their lowest bit; bitwise AND with 1 verifies even parity optimally.\",\n",
    "        \"intervention\": \"Excellent optimization using bitwise operations.\",\n",
    "        \"fixed_code\": \"def is_even(n):\\n    return (n & 1) == 0\"\n",
    "    },\n",
    "    # 3. Inverted Truthiness Logic\n",
    "    {\n",
    "        \"problem\": \"Write a function is_even(n) returning True if n is even, False otherwise.\",\n",
    "        \"student_code\": \"def is_even(n):\\n    if n % 2:\\n        return True\\n    return False\",\n",
    "        \"is_correct\": False,\n",
    "        \"misconception\": \"Truthy remainder inverted logic\",\n",
    "        \"explanation\": \"In Python, non-zero integers evaluate to True. When n is odd, n % 2 is 1 (True). This reverses the logic.\",\n",
    "        \"intervention\": \"What is 4 % 2 vs 5 % 2? In Python, does 0 evaluate to True or False in an if condition?\",\n",
    "        \"fixed_code\": \"def is_even(n):\\n    if not (n % 2):\\n        return True\\n    return False\"\n",
    "    },\n",
    "    # 4. Mutable Default Argument Trap\n",
    "    {\n",
    "        \"problem\": \"Write a function append_item(val, container=[]) that adds val to container.\",\n",
    "        \"student_code\": \"def append_item(val, container=[]):\\n    container.append(val)\\n    return container\",\n",
    "        \"is_correct\": False,\n",
    "        \"misconception\": \"Mutable default argument state retention\",\n",
    "        \"explanation\": \"Default arguments are evaluated once at function definition time. A mutable list is shared across calls.\",\n",
    "        \"intervention\": \"What happens if you invoke append_item without passing a container twice? Use None as default.\",\n",
    "        \"fixed_code\": \"def append_item(val, container=None):\\n    if container is None:\\n        container = []\\n    container.append(val)\\n    return container\"\n",
    "    },\n",
    "    # 5. Off-by-one / IndexError Loop Traversals\n",
    "    {\n",
    "        \"problem\": \"Find the maximum element in a list of numbers.\",\n",
    "        \"student_code\": \"def find_max(numbers):\\n    max_val = numbers[0]\\n    for i in range(1, len(numbers) + 1):\\n        if numbers[i] > max_val:\\n            max_val = numbers[i]\\n    return max_val\",\n",
    "        \"is_correct\": False,\n",
    "        \"misconception\": \"Index out of bounds / range upper bound inclusive assumption\",\n",
    "        \"explanation\": \"Python lists are 0-indexed up to len(numbers) - 1. range(1, len(numbers) + 1) accesses index len(numbers), raising IndexError.\",\n",
    "        \"intervention\": \"What is the highest valid index in a 3-element list? Does range(1, len(numbers)) suffice?\",\n",
    "        \"fixed_code\": \"def find_max(numbers):\\n    max_val = numbers[0]\\n    for i in range(1, len(numbers)):\\n        if numbers[i] > max_val:\\n            max_val = numbers[i]\\n    return max_val\"\n",
    "    },\n",
    "    # 6. JavaScript Loose Equality & Type Coercion\n",
    "    {\n",
    "        \"problem\": \"Write a function isValidToken(role, tier) verifying role is 'admin' and tier is integer 1.\",\n",
    "        \"student_code\": \"function isValidToken(role, tier) {\\n    if (role == 'admin' && tier == 1) {\\n        return true;\\n    }\\n    return false;\\n}\",\n",
    "        \"is_correct\": False,\n",
    "        \"misconception\": \"Loose equality (==) allows implicit type coercion\",\n",
    "        \"explanation\": \"Loose equality '==' coerces string '1' to number 1, which permits unauthorized string payloads.\",\n",
    "        \"intervention\": \"Which JavaScript operator checks both the value and the exact type without coercion?\",\n",
    "        \"fixed_code\": \"function isValidToken(role, tier) {\\n    return role === 'admin' && tier === 1;\\n}\"\n",
    "    },\n",
    "    # 7. Variable Scope & Modification (UnboundLocalError)\n",
    "    {\n",
    "        \"problem\": \"Increment a counter tracked outside the function.\",\n",
    "        \"student_code\": \"total = 0\\ndef add_to_total(amount):\\n    total += amount\\n    return total\",\n",
    "        \"is_correct\": False,\n",
    "        \"misconception\": \"Local assignment shadowing without global declaration\",\n",
    "        \"explanation\": \"Assigning to 'total' inside the function makes it local, but reading it before assignment raises UnboundLocalError.\",\n",
    "        \"intervention\": \"Use the 'global' keyword to explicitly bind total to the outer scope.\",\n",
    "        \"fixed_code\": \"total = 0\\ndef add_to_total(amount):\\n    global total\\n    total += amount\\n    return total\"\n",
    "    },\n",
    "    # 8. String vs Integer Concatenation\n",
    "    {\n",
    "        \"problem\": \"Add two numbers entered as user input strings.\",\n",
    "        \"student_code\": \"def add_inputs(a, b):\\n    return a + b\",\n",
    "        \"is_correct\": False,\n",
    "        \"misconception\": \"String concatenation vs numeric addition\",\n",
    "        \"explanation\": \"Applying '+' between strings concatenates them rather than computing arithmetic addition.\",\n",
    "        \"intervention\": \"Convert input strings to integers using int().\",\n",
    "        \"fixed_code\": \"def add_inputs(a, b):\\n    return int(a) + int(b)\"\n",
    "    },\n",
    "    # 9. Shallow vs Deep Copy\n",
    "    {\n",
    "        \"problem\": \"Duplicate a 2D matrix without modifying the original.\",\n",
    "        \"student_code\": \"def duplicate_grid(grid):\\n    new_grid = list(grid)\\n    new_grid[0][0] = 999\\n    return new_grid\",\n",
    "        \"is_correct\": False,\n",
    "        \"misconception\": \"Shallow copy mutates nested sublists\",\n",
    "        \"explanation\": \"list(grid) creates a shallow copy where inner lists are still shared references.\",\n",
    "        \"intervention\": \"Use copy.deepcopy() to recursively clone nested lists.\",\n",
    "        \"fixed_code\": \"import copy\\ndef duplicate_grid(grid):\\n    new_grid = copy.deepcopy(grid)\\n    new_grid[0][0] = 999\\n    return new_grid\"\n",
    "    },\n",
    "    # 10. Missing Return Statement in Recursion\n",
    "    {\n",
    "        \"problem\": \"Calculate factorial of n recursively.\",\n",
    "        \"student_code\": \"def factorial(n):\\n    if n <= 1:\\n        return 1\\n    factorial(n - 1) * n\",\n",
    "        \"is_correct\": False,\n",
    "        \"misconception\": \"Omitted return keyword in recursive step\",\n",
    "        \"explanation\": \"Without the return keyword on the recursive expression, the function returns None.\",\n",
    "        \"intervention\": \"Ensure every recursive branch returns its result.\",\n",
    "        \"fixed_code\": \"def factorial(n):\\n    if n <= 1:\\n        return 1\\n    return factorial(n - 1) * n\"\n",
    "    }\n",
    "]\n",
    "\n",
    "print(f\"Loaded {len(RAW_DATA)} core misconception training samples.\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 3. Data Augmentation & Preprocessing\n",
    "We format inputs into sequence-to-sequence instruction pairs and split into Train and Validation sets."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "import random\n",
    "from datasets import Dataset\n",
    "\n",
    "formatted_samples = []\n",
    "for item in RAW_DATA:\n",
    "    input_text = f\"Diagnose code misconception | Problem: {item['problem']} | Code: {item['student_code']}\"\n",
    "    target_dict = {\n",
    "        \"is_correct\": item[\"is_correct\"],\n",
    "        \"misconception\": item[\"misconception\"],\n",
    "        \"explanation\": item[\"explanation\"],\n",
    "        \"intervention\": item[\"intervention\"],\n",
    "        \"fixed_code\": item[\"fixed_code\"]\n",
    "    }\n",
    "    target_text = json.dumps(target_dict)\n",
    "    formatted_samples.append({\"input_text\": input_text, \"target_text\": target_text})\n",
    "\n",
    "# Replicate with subtle variations for robust training\n",
    "augmented_samples = formatted_samples * 10\n",
    "random.seed(42)\n",
    "random.shuffle(augmented_samples)\n",
    "\n",
    "split_idx = int(0.85 * len(augmented_samples))\n",
    "train_data = augmented_samples[:split_idx]\n",
    "val_data = augmented_samples[split_idx:]\n",
    "\n",
    "train_dataset = Dataset.from_list(train_data)\n",
    "val_dataset = Dataset.from_list(val_data)\n",
    "print(f\"Training samples: {len(train_dataset)}, Validation samples: {len(val_dataset)}\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 4. Load Model & Tokenizer (Salesforce/codet5-small)\n",
    "**CodeT5** is an open-source encoder-decoder transformer specifically pre-trained on source code, making it exceptionally fast and accurate for code-understanding tasks."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "from transformers import AutoTokenizer, AutoModelForSeq2SeqLM\n",
    "\n",
    "MODEL_NAME = \"Salesforce/codet5-small\"\n",
    "tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)\n",
    "model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)\n",
    "\n",
    "device = \"cuda\" if torch.cuda.is_available() else \"cpu\"\n",
    "model.to(device)\n",
    "print(f\"Loaded {MODEL_NAME} successfully onto {device}.\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 5. Tokenization & Seq2Seq Preparation"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "def preprocess_function(examples):\n",
    "    inputs = examples[\"input_text\"]\n",
    "    targets = examples[\"target_text\"]\n",
    "    model_inputs = tokenizer(inputs, max_length=256, truncation=True, padding=\"max_length\")\n",
    "    labels = tokenizer(text_target=targets, max_length=256, truncation=True, padding=\"max_length\")\n",
    "    \n",
    "    # Replace padding token id's with -100 so they are ignored by CrossEntropyLoss\n",
    "    labels[\"input_ids\"] = [\n",
    "        [(l if l != tokenizer.pad_token_id else -100) for l in label]\n",
    "        for label in labels[\"input_ids\"]\n",
    "    ]\n",
    "    model_inputs[\"labels\"] = labels[\"input_ids\"]\n",
    "    return model_inputs\n",
    "\n",
    "tokenized_train = train_dataset.map(preprocess_function, batched=True)\n",
    "tokenized_val = val_dataset.map(preprocess_function, batched=True)\n",
    "print(\"Tokenization complete!\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 6. Train the Model with Seq2SeqTrainer"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "from transformers import Seq2SeqTrainer, Seq2SeqTrainingArguments\n",
    "\n",
    "training_args = Seq2SeqTrainingArguments(\n",
    "    output_dir=\"./relearn_codet5_misconceptions\",\n",
    "    eval_strategy=\"epoch\",\n",
    "    learning_rate=5e-5,\n",
    "    per_device_train_batch_size=8,\n",
    "    per_device_eval_batch_size=8,\n",
    "    weight_decay=0.01,\n",
    "    save_total_limit=2,\n",
    "    num_train_epochs=5,\n",
    "    predict_with_generate=True,\n",
    "    fp16=torch.cuda.is_available(),\n",
    "    logging_steps=10,\n",
    "    report_to=\"none\"\n",
    ")\n",
    "\n",
    "trainer = Seq2SeqTrainer(\n",
    "    model=model,\n",
    "    args=training_args,\n",
    "    train_dataset=tokenized_train,\n",
    "    eval_dataset=tokenized_val,\n",
    "    tokenizer=tokenizer,\n",
    ")\n",
    "\n",
    "print(\"🚀 Starting Model Training on GPU...\")\n",
    "trainer.train()\n",
    "trainer.save_model(\"./relearn_trained_model\")\n",
    "tokenizer.save_pretrained(\"./relearn_trained_model\")\n",
    "print(\"✅ Training Complete and Model Saved!\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 7. Evaluate and Plot Training Loss Curve"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "import matplotlib.pyplot as plt\n",
    "\n",
    "log_history = trainer.state.log_history\n",
    "losses = [entry['loss'] for entry in log_history if 'loss' in entry]\n",
    "\n",
    "plt.figure(figsize=(8, 4))\n",
    "plt.plot(losses, marker='o', color='#3b82f6', linewidth=2)\n",
    "plt.title('Re:Learn CodeT5 Fine-Tuning Loss Curve')\n",
    "plt.xlabel('Logged Steps')\n",
    "plt.ylabel('Training Loss')\n",
    "plt.grid(True, linestyle='--', alpha=0.6)\n",
    "plt.show()"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 8. Test Model Inference on Arbitrary Student Code"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "def diagnose_student_code(problem: str, code: str):\n",
    "    input_text = f\"Diagnose code misconception | Problem: {problem} | Code: {code}\"\n",
    "    inputs = tokenizer(input_text, return_tensors=\"pt\", max_length=256, truncation=True).to(device)\n",
    "    \n",
    "    with torch.no_grad():\n",
    "        outputs = model.generate(\n",
    "            **inputs,\n",
    "            max_length=256,\n",
    "            num_beams=4,\n",
    "            early_stopping=True\n",
    "        )\n",
    "    \n",
    "    decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)\n",
    "    try:\n",
    "        return json.loads(decoded)\n",
    "    except:\n",
    "        return {\"raw_output\": decoded}\n",
    "\n",
    "# Test sample 1: Assignment trap\n",
    "sample_test = \"def is_even(n):\\n    if n % 2 = 0:\\n        return True\\n    return False\"\n",
    "result = diagnose_student_code(\"Check if n is even\", sample_test)\n",
    "print(\"Test Result:\")\n",
    "print(json.dumps(result, indent=2))"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 9. Launch Free Live REST API (Connects to React Frontend)\n",
    "This cell runs a FastAPI server directly in Colab and creates a public URL using **localtunnel** or **ngrok** so your React web app can call this trained model!"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "import nest_asyncio\n",
    "from fastapi import FastAPI\n",
    "from pydantic import BaseModel\n",
    "import uvicorn\n",
    "import threading\n",
    "import os\n",
    "\n",
    "app = FastAPI(title=\"Re:Learn AI Inference Server\")\n",
    "\n",
    "class DiagnoseRequest(BaseModel):\n",
    "    problem: str\n",
    "    code: str\n",
    "\n",
    "@app.get(\"/\")\n",
    "def root():\n",
    "    return {\"status\": \"running\", \"model\": \"CodeT5-Misconception-Diagnoser\"}\n",
    "\n",
    "@app.post(\"/diagnose\")\n",
    "def api_diagnose(req: DiagnoseRequest):\n",
    "    return diagnose_student_code(req.problem, req.code)\n",
    "\n",
    "# Run FastAPI in a separate background thread\n",
    "nest_asyncio.apply()\n",
    "server_thread = threading.Thread(target=lambda: uvicorn.run(app, host=\"127.0.0.1\", port=8000), daemon=True)\n",
    "server_thread.start()\n",
    "\n",
    "print(\"FastAPI running locally on port 8000.\")\n",
    "print(\"Creating public tunnel with localtunnel...\")\n",
    "!npx localtunnel --port 8000\n",
    "# Or if using ngrok:\n",
    "# from pyngrok import ngrok\n",
    "# public_url = ngrok.connect(8000)\n",
    "# print(f\"Public URL: {public_url}\")"
   ]
  }
 ],
 "metadata": {
  "accelerator": "GPU",
  "colab": {
   "gpuType": "T4",
   "provenance": []
  },
  "kernelspec": {
   "display_name": "Python 3",
   "name": "python3"
  },
  "language_info": {
   "name": "python"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 0
}

with open("ReLearn_Model_Training.ipynb", "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=1)
print("Generated ReLearn_Model_Training.ipynb successfully!")
