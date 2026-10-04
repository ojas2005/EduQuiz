import pytest
from app.learning import grade, demo_curriculum, demo_paragraphs, demo_replacement_quiz, Curriculum

def test_demo_validates():
    curriculum=Curriculum(missions=demo_curriculum())
    assert len(curriculum.missions)==3

def test_perfect_score_has_no_weaknesses():
    questions=demo_curriculum()[0]['questions']
    result=grade(questions,[q['correct'] for q in questions])
    assert result['score']==100
    assert result['passed'] is True
    assert result['weaknesses']==[]

def test_skill_evidence_and_failure():
    questions=[{'correct':0,'skill':'subjects','options':['yes','no','x','y'],'explanation':'The subject is correct.'}, {'correct':1,'skill':'predicates','options':['yes','no','x','y'],'explanation':'The predicate is correct.'}]
    result=grade(questions,[0,0])
    assert result['score']==50
    assert result['strengths']==['subjects']
    assert result['weaknesses']==['predicates']
    assert result['skills']=={'subjects':[1,1],'predicates':[0,1]}
    assert result['passed'] is False

def test_exact_eighty_passes():
    q={'correct':0,'skill':'subject','options':['yes','no','x','y'],'explanation':'An explanation'}
    assert grade([q]*5,[0,0,0,0,1])['passed'] is True

def test_length_mismatch_is_not_silently_graded():
    with pytest.raises(ValueError): grade(demo_curriculum()[0]['questions'],[0])

@pytest.mark.parametrize('difficulty,importance,count', [
    ('foundational','supporting',3), ('foundational','core',4), ('foundational','essential',5),
    ('intermediate','supporting',4), ('intermediate','core',5), ('intermediate','essential',6),
    ('advanced','supporting',5), ('advanced','core',6), ('advanced','essential',8),
])
def test_question_count_tracks_difficulty_and_importance(difficulty, importance, count):
    from app.learning import Mission
    data={**demo_curriculum()[0], 'difficulty':difficulty, 'importance':importance}
    originals=data['questions'][:2]
    data['questions']=[{**originals[index%2], 'prompt': f"{originals[index%2]['prompt']} Example {index+1}."} for index in range(count)]
    assert len(Mission(**data).questions)==count
    data['questions']=data['questions'][:-1]
    with pytest.raises(ValueError): Mission(**data)

def test_quiz_can_exceed_base_budget_to_cover_every_topic():
    from app.learning import Mission
    data={**demo_curriculum()[0]}
    data['quiz_topics']=[f'Topic {index}' for index in range(5)]
    data['questions']=[{**data['questions'][0], 'skill': topic, 'prompt': f"A learner applies {topic} in a new situation. Which choice fits?"} for topic in data['quiz_topics']]
    assert len(Mission(**data).questions)==5
    data['questions']=data['questions'][:-1]
    with pytest.raises(ValueError, match='at least 5 questions'):
        Mission(**data)
    data['questions'].append(data['questions'][0])
    with pytest.raises(ValueError, match='Every quiz topic'):
        Mission(**data)


def test_demos_have_variable_chapter_and_quiz_counts():
    sentences=Curriculum(missions=demo_curriculum())
    paragraphs=Curriculum(missions=demo_paragraphs())
    assert len(sentences.missions)==3 and len(paragraphs.missions)==2
    assert [len(m.questions) for m in sentences.missions]==[3,4,6]
    assert [len(m.questions) for m in paragraphs.missions]==[3,5]

@pytest.mark.parametrize('mission', demo_curriculum()+demo_paragraphs())
def test_demo_retry_changes_prompts_and_keeps_coverage_and_explanations(mission):
    fresh=demo_replacement_quiz(mission)
    assert {q['prompt'] for q in fresh}.isdisjoint({q['prompt'] for q in mission['questions']})
    assert set(mission['quiz_topics']) <= {q['skill'] for q in fresh}
    assert all(len(q['option_explanations'])==4 for q in fresh)
    next_set=demo_replacement_quiz({**mission,'questions':fresh,'quiz_revision':1})
    assert {q['prompt'] for q in next_set}.isdisjoint({q['prompt'] for q in fresh})

def test_feedback_explains_selected_wrong_option_and_correct_option():
    question=demo_curriculum()[0]['questions'][0]
    wrong=(question['correct']+1)%4
    feedback=grade([question],[wrong])['feedback'][0]
    assert feedback['prompt']==question['prompt']
    assert feedback['selected_answer']==question['options'][wrong]
    assert feedback['selected_explanation']==question['option_explanations'][wrong]
    assert feedback['correct_explanation']==question['option_explanations'][question['correct']]


def test_next_topic_uses_saved_suggestion_even_after_remediation():
    from app.learning import topic_suggestion
    missions=[{'next_topic':{'topic':'Fractions','reason':'Use whole-number arithmetic to compare parts.'}}, {'title':'Review'}]
    assert topic_suggestion('Arithmetic',missions)['topic']=='Fractions'
    assert topic_suggestion('Sentences',[])['topic']=='Paragraphs'
    assert topic_suggestion('Paragraphs',[])['topic']=='Essay structure'


def test_same_topic_is_never_suggested_as_its_own_successor():
    from app.learning import topic_suggestion
    assert topic_suggestion('Sentences',[{'next_topic':{'topic':'sentences','reason':'This is the exact same topic again.'}}])['topic']=='Paragraphs'
