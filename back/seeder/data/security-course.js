/** Review-ready development curriculum: contextual questions, no external files or services. */
const {validateAssessment} = require('../../src/utils/assessment');
// Correct choice is first here; deterministic rotation below distributes answer positions.
const items = [
 ['An API receives a password at registration. How should it store it?', 'A salted adaptive password hash', 'Plain text', 'Reversible Base64', 'The password in an application log'],
 ['A JWT payload is readable by its holder. Which statement is correct?', 'Signing protects integrity, not confidentiality', 'All signed payloads are encrypted', 'A signature proves administrator access', 'The payload cannot be copied'],
 ['A user changes /orders/123 to /orders/124. What must the API check?', 'Permission to access that specific order', 'Only whether the ID is numeric', 'Whether the button was visible', 'Whether the user knows the URL'],
 ['A request lacks a valid session. Which status best describes the problem?', '401 Unauthorized', '201 Created', '204 No Content', '409 Conflict'],
 ['An authenticated learner calls an administrator-only endpoint. What should happen?', 'Return 403 without performing the operation', 'Trust the submitted role field', 'Allow it when called from the browser', 'Return all administrator records'],
 ['A client submits role=admin during learner registration. What should the server do?', 'Assign the allowed registration role on the server', 'Copy the supplied role into the user record', 'Trust a hidden role input', 'Grant the role until the next login'],
 ['A price is negative in a direct HTTP request that bypasses the form. Where must it be rejected?', 'In server-side validation before writing', 'Only in the browser', 'Only in the reporting dashboard', 'After charging the learner'],
 ['Why should an update endpoint explicitly allow accepted fields?', 'To prevent unintended mass assignment', 'To avoid all database indexes', 'To replace authentication', 'To make every field public'],
 ['A client claims that a file is image/png. What is a reasonable additional check?', 'Check size, extension and actual file content', 'Trust the MIME header alone', 'Trust only the original filename', 'Accept every file under a random name'],
 ['A failed sign-in response differs for existing and unknown emails. What risk does this introduce?', 'Account enumeration', 'Automatic password encryption', 'Improved authorization', 'A database backup'],
 ['Where should production signing keys be configured?', 'In protected deployment configuration', 'In browser JavaScript', 'In a public seed file', 'In a response header'],
 ['What should application logs avoid recording?', 'Passwords, session tokens and authenticator secrets', 'A request correlation ID', 'An HTTP status code', 'A controlled error category'],
 ['What protects credentials against interception while in transit?', 'HTTPS with properly configured TLS', 'Base64 encoding', 'A hidden HTML input', 'Renaming the login endpoint'],
 ['A TOTP-enabled user supplies a correct password. When may the final session be issued?', 'After successful second-factor verification', 'Before any factor verification', 'When the browser says verification passed', 'After displaying the authenticator prompt'],
 ['A recovery code was successfully used. What should happen to that code?', 'It should become unusable', 'It should become the new password', 'It should be emailed in every notification', 'It should remain valid indefinitely'],
 ['An attacker repeatedly sends incorrect factor codes. Which control is appropriate?', 'Bounded attempts and an expiring challenge', 'Unlimited retries', 'Returning the correct code in an error', 'Disabling second-factor checks'],
 ['A user changes a password after a suspected compromise. What should happen to old sessions?', 'Invalidate them according to the session policy', 'Extend their lifetime', 'Publish their tokens to a log', 'Convert them into administrator sessions'],
 ['Why is hiding an administrative button insufficient authorization?', 'An attacker can call the endpoint directly', 'Hidden buttons cannot be styled', 'It stops all HTTP requests', 'The database automatically trusts hidden controls'],
 ['An assessment is returned to a learner before submission. Which data should be withheld?', 'Correct-answer keys', 'The question text', 'The available choices', 'The permitted time limit'],
 ['A browser reports score=100 after a quiz. What should the server use for grading?', 'Stored answer keys and the submitted responses', 'The claimed score', 'The number of rendered buttons', 'The client device clock alone'],
 ['A draft course has an invalid answer index in its final exam. What should approval do?', 'Reject publication and leave it a draft', 'Publish because the question count is sufficient', 'Discard the exam silently', 'Make the learner choose the answer key'],
 ['An archived course is submitted for publication. What is a sensible workflow?', 'Require restoration before approval', 'Publish it while leaving it archived', 'Delete all its learner histories', 'Replace its trainer automatically'],
 ['A course price changes after an earlier purchase. Which amount belongs in that purchase history?', 'The amount captured for that purchase', 'Always the newest course price', 'Zero for every old purchase', 'A price supplied by the viewing browser'],
 ['A database error contains connection details. What should a public API response expose?', 'A controlled message without internal credentials', 'The complete connection string', 'All environment variables', 'The database password for debugging'],
 ['What is the safest default for a development seeder against an existing database?', 'Require explicit write permission and preserve existing records', 'Reset every password on each run', 'Disable two-factor authentication', 'Delete progress whenever content changes'],
];
const questions = items.map(([texte,...choices],i) => {
 const shift=i%choices.length;
 return {texte,type:'single',options:[...choices.slice(shift),...choices.slice(0,shift)],correctAnswer:(choices.length-shift)%choices.length,points:1,timeLimitSeconds:0};
});
module.exports = {
 title:'API Security — Authentication and Access Control',
 description:'Practice realistic API security decisions: credential storage, authorization, second-factor sign-in, input checks and safe assessment publishing. Complete review-ready draft for administrator approval.',
 category:'Development',tags:['api','security','authentication','authorization'],price:75,isApproved:false,trainerEmail:'trainer3@test.com',
 lessons:[{title:'Protecting Accounts and API Resources',content:'Authenticate callers before granting access. Authorize every requested resource independently of browser controls. Treat client input, MIME headers, scores and role fields as untrusted. Store adaptive password hashes, keep signing keys in protected configuration, and protect transport with TLS. For two-factor accounts, issue the final session only after verification; limit attempts and consume recovery codes once. Grade assessments server-side without exposing answer keys, and validate complete curricula before publication.',order:1,isFree:true,quiz:validateAssessment({questions:questions.slice(0,20),noteMinimale:80,maxAttempts:3})}],
 finalExam:validateAssessment({questions,noteMinimale:80,maxAttempts:3}),
};
