import pytest
from app.titles import course_title
from app.learning import Curriculum, demo_curriculum


def test_generated_title_is_separate_from_learning_request():
    topic = 'I want to learn how computers communicate and store data, including HTTP, DNS, TCP and SQL.'
    curriculum = Curriculum(title='System Design Foundations', missions=demo_curriculum())
    assert course_title(topic, curriculum.title) == 'System Design Foundations'
    assert topic.startswith('I want to learn')


def test_existing_syllabus_uses_its_heading():
    topic = 'System Design Foundations - Networking: HTTP, DNS, TCP, TLS, Proxies, Load Balancers - Databases: SQL, Indexes, Transactions, Replication'
    assert course_title(topic) == 'System Design Foundations'


@pytest.mark.parametrize('topic,proposed', [
    ('Sentences', None), ('Paragraphs', None), ('Python', None),
    ('Teach me system design including networking and storage', None),
    ('How to write better English with clear paragraphs', None),
    ('C++', None), ('Learn about SQL indexes', None),
    ('x'*300, None), ('---', None),
    ('System design', 'A title containing far too many words to fit'),
    ('System design', 'Short'), ('System design', ' '),
])
def test_fallback_title_budget(topic, proposed):
    title = course_title(topic, proposed)
    assert 3 <= len(title.split()) <= 5
    assert len(title) <= 80


def test_generated_heading_normalizes_whitespace():
    assert course_title('request', '  Understanding\nDistributed   Systems  ') == 'Understanding Distributed Systems'
