const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hasAssessment, calculateProgress } = require('../src/utils/learningProgress');
test('quiz-bearing lessons cannot use read completion', () => {
 assert.equal(hasAssessment({ quiz: {questions:[{}]} }), true);
 assert.equal(hasAssessment({ quiz2: {questions:[{}]} }), true);
 assert.equal(hasAssessment({}), false);
});
test('zero lessons is not a completed course', () => assert.equal(calculateProgress([],[],false,false).completed,false));
test('unknown IDs and duplicate IDs do not inflate progress', () => assert.equal(calculateProgress([{_id:'a'},{_id:'b'}],['a','a','x'],false,false).progress,50));
test('lesson completion never bypasses a final exam', () => assert.deepEqual(calculateProgress([{_id:'a'}],['a'],false,true),{progress:100,completed:false,allLessonsCompleted:true}));
test('passed final + completed curriculum is completed', () => assert.equal(calculateProgress([{_id:'a'}],['a'],true,true).completed,true));
test('course without an exam completes from curriculum', () => assert.equal(calculateProgress([{_id:'a'}],['a'],false,false).completed,true));

test('refreshing lesson progress does not revoke an already passed final exam', () => assert.deepEqual(calculateProgress([{_id:'a'},{_id:'b'}],['a'],true,true),{progress:100,completed:true,allLessonsCompleted:false}));
