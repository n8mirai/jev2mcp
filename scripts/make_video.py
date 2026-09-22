"""Build a narrated walkthrough from actual UI captures. macOS: Pillow, say, ffmpeg."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import subprocess, json, textwrap
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'artifacts'; FRAMES=OUT/'video-frames'; SEG=OUT/'segments'
FRAMES.mkdir(exist_ok=True); SEG.mkdir(exist_ok=True)
FONT='/System/Library/Fonts/Avenir Next.ttc'
font=lambda n:ImageFont.truetype(FONT,n)
scenes=[
 ('00-home.png','01 / THE IDEA','One question.\nBefore Send.','Your prompt. Jev.\nThe right @plugins.',None,
  'Meet Jev Relay. A small, local middle step between your prompt and ChatGPT. Jev answers one question: does this request need any of your enabled plugins? These are actual captures from the running demo.'),
 ('01-drive.png','02 / DOCUMENT LOOKUP','Bring the\nright tool.','A real Jev call.\nOriginal words preserved.',(35,410,1220,1090),
  'Ask to find a project brief in Google Drive. Jev selects Google Drive, and the companion adds its at mention before the original prompt. The probability and measured request time remain visible.'),
 ('02-plain.png','03 / NO TOOLS NEEDED','Just your\nwords.','No plugin injection.\nNo extra prompt instructions.',(35,410,1220,1040),
  'Now ask why the sky is blue. No account records or plugin workflow are needed. Jev returns a low tools probability, so the prompt stays unchanged. The model judges intent, rather than matching a keyword.'),
 ('03-multiple.png','04 / COMBINE CAPABILITIES','One prompt.\nTwo plugins.','Independent judgments.\nOne TypeSafe request.',(35,410,1220,1090),
  'Ask for a meeting time from email and a calendar availability check. Both Gmail and Google Calendar are selected. Each plugin gets an independent yes or no probability, batched into the same request.'),
 ('04-extension.png','05 / EXTENSION TEST LAB','Intercept.\nAttach. Send.','Same production adapter.\nLocal test composer.',None,
  'The integration lab runs the production extension script. It intercepts Send, calls Jev, chooses the picker entries, verifies mention nodes, and submits once. This is a local test composer, not a recorded ChatGPT conversation.'),
 ('06-setup.png','06 / DESKTOP & SETUP','A local\ncompanion.','Browser: paired extension.\nNative app: copy and paste.',None,
  'The API key stays on the local bridge. Pair the browser extension, or copy the routed prompt into native ChatGPT and select its plugins. Native desktop support is a handoff; it does not intercept the app.'),
 ('05-plugins.png','07 / OPEN SOURCE','Make it\nyour own.','github.com/n8mirai/jev-relay\nMIT licensed · Experimental',None,
  'Enable only plugins you actually have. Nineteen deterministic tests pass, and eight live smoke cases behaved as expected, including one held for review. Signed in ChatGPT injection still needs validation. The source, evidence, and demo are on GitHub.')
]
transcript=[]; paths=[]
for i,(shot,kicker,title,desc,crop,narration) in enumerate(scenes):
 im=Image.new('RGB',(1920,1080),'#10211c');d=ImageDraw.Draw(im)
 d.rounded_rectangle((64,54,126,116),18,fill='#d8fa78');d.line((78,85,109,85),fill='#173021',width=5);d.line((98,73,110,85,98,97),fill='#173021',width=5)
 d.text((144,64),'jev / relay',font=font(30),fill='#eef5e2');d.text((1450,74),'LIVE API · UI WALKTHROUGH',font=font(16),fill='#a1b392')
 d.line((64,151,1856,151),fill='#3b503f',width=2)
 d.text((70,235),kicker,font=font(17),fill='#b9d59c')
 y=295
 for line in title.split('\n'):d.text((64,y),line,font=font(62),fill='#eaf0df');y+=79
 y+=40
 for line in desc.split('\n'):d.text((70,y),line,font=font(22),fill='#c2d99e');y+=37
 d.text((70,815),f'{i+1:02d}  /  07',font=font(21),fill='#849b7a')
 d.text((70,862),'TypeSafe System One',font=font(20),fill='#849b7a')
 src=Image.open(OUT/shot).convert('RGB');src=src.crop(crop) if crop else src
 box=(580,194,1856,934);d.rounded_rectangle(box,20,fill='#1b3025',outline='#50664a',width=2)
 size=ImageOps.contain(src,(1238,700),Image.Resampling.LANCZOS);im.paste(size,(box[0]+(1276-size.width)//2,box[1]+(740-size.height)//2))
 d.text((600,950),'ACTUAL LIVE UI CAPTURE' + (' · LOCAL FIXTURE' if i==4 else ' · CONFIGURED DEMO CATALOG'),font=font(14),fill='#a4b596')
 d.line((64,1015,1856,1015),fill='#344d3a',width=2);d.line((64,1015,64+int(1792*(i+1)/len(scenes)),1015),fill='#d8fa78',width=4)
 frame=FRAMES/f'{i:02d}.png';im.save(frame)
 txt=OUT/f'narration-{i}.txt';txt.write_text(narration);audio=OUT/f'narration-{i}.aiff'
 subprocess.run(['say','-v','Samantha','-r','178','-f',str(txt),'-o',str(audio)],check=True)
 dur=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(audio)]).decode())+1.0
 segment=SEG/f'{i:02d}.mp4';paths.append(segment)
 subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-loop','1','-i',str(frame),'-i',str(audio),'-t',str(dur),'-vf',f'fade=t=in:st=0:d=0.3,fade=t=out:st={dur-.35}:d=0.35,format=yuv420p','-af','apad=pad_dur=1','-r','30','-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-b:a','160k','-movflags','+faststart',str(segment)],check=True)
 transcript.append({'scene':i+1,'title':title.replace('\n',' '),'duration':round(dur,2),'narration':narration});print('Rendered',i+1,round(dur,1),flush=True)
concat=SEG/'concat.txt';concat.write_text(''.join(f"file '{p.name}'\n" for p in paths))
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(OUT/'Jev-Relay-Demo.mp4')],check=True)
(OUT/'demo-transcript.json').write_text(json.dumps(transcript,indent=2))
print('Saved',OUT/'Jev-Relay-Demo.mp4',flush=True)
