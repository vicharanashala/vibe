TASK_DESCRIPTION_CASE_STUDY = """
                You are an advanced AI tasked with generating university-level case-study-based multiple-choice questions (MCQs) from a given transcript.
                Your goal is to:
                1. Create a unique case study or scenario inspired by the transcript. The case study should:
                    - Be an example or situation that applies key ideas, concepts, or theories from the transcript.
                    - Go beyond summarizing the transcript by crafting a practical or hypothetical context.
                2. Frame {0} questions that require analytical thinking, problem-solving, or evaluation based on the case study.
                3. Provide 4 answer options for each question, ensuring one is correct and the others are plausible but incorrect.
                4. Specify the index (0-based) of the correct answer for each question.
                5. Format your response as a JSON object where the case study is provided along with the questions. Use the structure:
                {{
                    "case_study": "<case_study_paragraph>",
                    "questions": [
                        {{
                            "question": "<question_text>", 
                            "options": ["<option1>", "<option2>", "<option3>", "<option4>"], 
                            "correct_answer": <index_of_correct_option> 
                        }},
                        ...
                    ]
                }}
                Types of questions to generate:
                1. Analytical: Require reasoning or critical thinking about the case study.
                2. Application-Based: Apply concepts to solve problems or make decisions in the context of the case study.
                3. Evaluation: Require judgment, interpretation, or assessment of the situation presented.
                Example output:
                {{
                    "case_study": "A new factory has been set up near a river, causing concerns about pollution. The factory produces textile dyes, which may contaminate water sources. The local government needs to balance economic benefits with environmental risks.",
                    "questions": [
                        {{
                            "question": "What is the most likely environmental impact of the factory's operations?",
                            "options": ["Decreased oxygen levels in the river.", "Improved water clarity.", "Increase in fish population.", "Reduction in soil erosion."],
                            "correct_answer": 0
                        }},
                        {{
                            "question": "Which of the following actions would best mitigate the environmental risks posed by the factory?",
                            "options": ["Enforcing stricter emission controls.", "Encouraging higher production rates.", "Diverting the river away from the factory.", "Promoting the use of synthetic materials."],
                            "correct_answer": 0
                        }},
                        {{
                            "question": "How might local residents be affected if pollution levels rise?",
                            "options": ["Improved access to clean drinking water.", "Increased health issues such as skin diseases.", "Higher crop yields in nearby farms.", "Reduced water temperatures in the river."],
                            "correct_answer": 1
                        }}
                    ]
                }}
            """

TASK_DESCRIPTION_ANALYTICAL = """
            You are an advanced AI designed to generate challenging multiple-choice questions (MCQs) for university-level exams.
            Your goal is to:
            1. Identify core concepts, theories, or key ideas in the transcript.
            2. Frame questions that require analytical thinking, application of knowledge, or evaluation.
            3. Use domain-specific language and include plausible distractors that reflect common misconceptions or similar concepts.
            4. Include 4 answer options for each question, specifying the correct answer index.
            5. Format your response as a JSON list where each entry follows the structure:
            { "question": "<question_text>", "options": ["<option1>", "<option2>", "<option3>", "<option4>"], "correct_answer": <index_of_correct_option> }
            Types of questions:
            1. Analytical: Require reasoning or critical thinking.
            2. Application-Based: Apply concepts to new scenarios or problems.
            3. Evaluation: Require judgment or interpretation.
            Example output:
            {
                "questions" : [
                    {
                        "question": "Why is photosynthesis critical for the survival of most ecosystems?",
                        "options": ["It is the only source of carbon dioxide.", "It provides oxygen for respiration.", "It creates heat energy for plants.", "It prevents water loss in leaves."],
                        "correct_answer": 1
                    },
                    {
                        "question": "What would likely occur if Earth's axial tilt increased?",
                        "options": ["Stronger seasonal temperature differences.", "Fewer hours of daylight at the poles.", "Reduced intensity of sunlight near the equator.", "More uniform global climates year-round."],
                        "correct_answer": 0
                    },
                    {
                        "question": "How does the principle of competitive exclusion influence species diversity within an ecosystem?",
                        "options": ["It causes a uniform distribution of species.", "It eliminates all predator-prey interactions.", "It leads to resource partitioning among species.", "It prevents mutualistic relationships."],
                        "correct_answer": 2
                    }
                ]
            }
        """


PROMPT_CASE_STUDY = '''

Here is the transcript content:

{0}

Generate {1} questions as a JSON object in the following format:
{{
    "case_study": "<case_study_text>",
        "questions": [
                        {{
                            "question": "<question_text>",
                            "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
                            "correct_answer": <index_of_correct_option>
                        }},
                        {{
                            "question": "<question_text>",
                            "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
                            "correct_answer": <index_of_correct_option>
                       }},
                       {{
                            "question": "<question_text>",
                            "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
                            "correct_answer": <index_of_correct_option>
                       }}
                     ]
}}.'''

PROMPT_ANALYTICAL = '''

Here is the transcript content:

{0}

Generate {1} questions as a JSON object in the following format:
{{
    "questions": [
                    {{
                        "question": "<question_text>",
                        "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
                        "correct_answer": <index_of_correct_option>
                    }},
                    {{
                        "question": "<question_text>",
                        "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
                        "correct_answer": <index_of_correct_option>
                    }},
                    {{
                        "question": "<question_text>",
                        "options": ["<option1>", "<option2>", "<option3>", "<option4>"],
                        "correct_answer": <index_of_correct_option>
                    }}
                ]
}}.'''
