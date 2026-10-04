import asyncio
import json
from types import SimpleNamespace
import pytest
from app import tutor, learning


def test_context_excludes_quizzes_and_keeps_followups():
    mission = {**learning.demo_curriculum()[0], 'private': 'DO_NOT_SEND'}
    history = [SimpleNamespace(role='user', content='What is a subject?'),
               SimpleNamespace(role='assistant', content='Who or what the sentence is about.')]
    messages = tutor.tutor_messages('Sentences', mission, 'Give another example', history)
    context = json.loads(messages[1][1].removeprefix('Saved lesson context: '))
    assert set(context['mission']) == {'title', 'objective', 'lesson', 'tasks'}
    assert context['mission']['lesson'] == mission['lesson']
    assert 'DO_NOT_SEND' not in str(messages)
    assert mission['questions'][0]['prompt'] not in str(messages)
    assert messages[-3:] == [('human', history[0].content), ('ai', history[1].content), ('human', 'Give another example')]


@pytest.mark.parametrize('content,expected', [
    (' A clear explanation. ', 'A clear explanation.'),
    ([{'type': 'thinking', 'thinking': 'private reasoning'}, {'type': 'text', 'text': 'A helpful example.'}], 'A helpful example.'),
    ('x' * 5000, 'x' * 4000),
])
def test_provider_reply_formats_and_output_budget(monkeypatch, content, expected):
    async def invoke(messages):
        assert messages[-1] == ('human', 'Explain it')
        return SimpleNamespace(content=content)
    def model(provider, name, key, max_tokens):
        assert (provider, name, key, max_tokens) == ('groq', 'test-model', 'fake-key', 1000)
        return SimpleNamespace(ainvoke=invoke)
    monkeypatch.setattr(tutor, 'create_model', model)
    assert asyncio.run(tutor.answer_doubt('groq', 'test-model', 'fake-key', 'Sentences', learning.demo_curriculum()[0], 'Explain it', [])) == expected


def test_empty_provider_reply_is_a_recoverable_failure(monkeypatch):
    async def invoke(messages):
        return SimpleNamespace(content=[])
    monkeypatch.setattr(tutor, 'create_model', lambda *args, **kwargs: SimpleNamespace(ainvoke=invoke))
    with pytest.raises(ValueError):
        asyncio.run(tutor.answer_doubt('openai', 'test', 'fake-key', 'Sentences', learning.demo_curriculum()[0], 'Help', []))


@pytest.mark.parametrize('provider', ['openai', 'anthropic', 'groq'])
def test_shared_model_factory_keeps_provider_and_budget(monkeypatch, provider):
    monkeypatch.setattr(learning, 'ChatOpenAI', lambda **kwargs: ('openai', kwargs))
    monkeypatch.setattr(learning, 'ChatAnthropic', lambda **kwargs: ('anthropic', kwargs))
    client, options = learning.create_model(provider, 'test-model', 'fake-key', max_tokens=1000)
    assert client == ('anthropic' if provider == 'anthropic' else 'openai')
    assert options['model'] == 'test-model' and options['max_tokens'] == 1000
    assert options.get('base_url') == ('https://api.groq.com/openai/v1' if provider == 'groq' else None)
