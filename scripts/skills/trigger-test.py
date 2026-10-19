"""Trigger test for Zelaté skills (DEV-0 DoD).

Usage: python3 scripts/skills/trigger-test.py <copy-of-the-repo> <output.json>
Runs each query of .claude/skills/<skill>/evals/trigger-eval.json through `claude -p`
in the repo copy and checks whether the skill is loaded within the first turns.
"""
import json,subprocess,sys,concurrent.futures as cf
repo,outfile=sys.argv[1],sys.argv[2]
def run(skill,q):
    p=subprocess.Popen(['claude','-p',q,'--output-format','stream-json','--verbose','--max-turns','4',
        '--disallowedTools','Bash','Edit','Write','WebFetch','WebSearch','Agent','Task'],
        cwd=repo,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
    hit=False; tools=[]
    try:
        for line in p.stdout:
            try: ev=json.loads(line)
            except: continue
            if ev.get('type')=='assistant':
                for c in ev.get('message',{}).get('content',[]):
                    if c.get('type')=='tool_use':
                        n=c.get('name'); i=c.get('input',{}); tools.append(n)
                        if (n=='Skill' and skill in str(i.get('skill',''))) or (n=='Read' and f'skills/{skill}/' in str(i.get('file_path',''))):
                            hit=True
            if hit: break
    finally:
        p.kill()
    return hit,tools[:4]
out={}
jobs=[]
with cf.ThreadPoolExecutor(6) as ex:
    for k in ['zelate-domain','feature-workflow','db-migration-rls']:
        for x in json.load(open(f'{repo}/.claude/skills/{k}/evals/trigger-eval.json')):
            jobs.append((k,x,ex.submit(run,k,x['query'])))
    for k,x,f in jobs:
        try: hit,tools=f.result(timeout=200)
        except Exception as e: hit,tools=None,[str(e)]
        ok = (hit==x['should_trigger'])
        out.setdefault(k,[]).append({'query':x['query'],'should_trigger':x['should_trigger'],'triggered':hit,'pass':ok,'first_tools':tools})
json.dump(out,open(outfile,'w'),ensure_ascii=False,indent=1)
for k,v in out.items():
    print(k, sum(r['pass'] for r in v),'/',len(v))
    for r in v: print('  ', 'OK ' if r['pass'] else 'KO ', r['should_trigger'], r['triggered'], r['first_tools'], r['query'][:55])
