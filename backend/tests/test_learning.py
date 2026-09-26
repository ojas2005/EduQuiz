import pytest
from app.learning import grade, demo_curriculum, Curriculum

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
