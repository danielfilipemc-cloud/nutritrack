import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRecoveryState,isRecoveryCallback,recoveryPasswordError} from '../lib/password-recovery';
test('recovery callback recognizes error/recovery intent without retaining tokens or trusting redirect parameters',()=>{
 for(const suffix of ['#type=recovery&access_token=synthetic','#error_code=otp_expired','?error=access_denied','?recuperacao=1'])assert.equal(isRecoveryCallback('https://app.example.invalid/'+suffix),true);
 for(const suffix of ['','?next=https://evil.invalid','?type=recovery','#type=signup'])assert.equal(isRecoveryCallback('https://app.example.invalid/'+suffix),false);
 assert.equal(isRecoveryCallback('https://app.example.invalid/convite#error_code=otp_expired'),false);
});
test('ordinary cached sessions never grant a recovery form after a failed callback',()=>{
 const s=createRecoveryState(true);s.observe('INITIAL_SESSION','old-user');s.observe('SIGNED_IN','old-user');s.settle();assert.deepEqual(s.getSnapshot(),{phase:'invalid'});
 s.observe('PASSWORD_RECOVERY','old-user');assert.equal(s.getSnapshot().phase,'invalid');
 const normal=createRecoveryState(false);normal.observe('PASSWORD_RECOVERY','other-tab');assert.equal(normal.getSnapshot().phase,'none');
});
test('confirmed recovery binds identity, survives refresh and is invalidated by logout or another account',()=>{
 const s=createRecoveryState(true);s.observe('PASSWORD_RECOVERY','user-a');s.settle();assert.deepEqual(s.getSnapshot(),{phase:'ready',userId:'user-a'});
 s.observe('TOKEN_REFRESHED','user-a');assert.equal(s.getSnapshot().phase,'ready');s.observe('SIGNED_IN','user-b');assert.deepEqual(s.getSnapshot(),{phase:'invalid'});
 const logout=createRecoveryState(true);logout.observe('PASSWORD_RECOVERY','user-a');logout.observe('SIGNED_OUT');assert.equal(logout.getSnapshot().phase,'invalid');
});
test('completed recovery is not replaced by subsequent logout notifications',()=>{
 const s=createRecoveryState(true);s.observe('PASSWORD_RECOVERY','user-a');s.complete();s.observe('SIGNED_OUT');assert.equal(s.getSnapshot().phase,'complete');
});
test('password validation preserves spaces and requires confirmation without inventing strength guarantees',()=>{
 assert.ok(recoveryPasswordError('short','short'));assert.ok(recoveryPasswordError('TwelveChars123','different'));
 assert.equal(recoveryPasswordError('  TwelveChars123  ','  TwelveChars123  '),'');
});
