import zipfile,re,sys,xml.etree.ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def read(path):
    z=zipfile.ZipFile(path)
    ss=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS['m'])))
    sheets={}
    for n in sorted(x for x in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml',x)):
        rows=[]
        for r in ET.fromstring(z.read(n)).iter('{%s}row'%NS['m']):
            row={}
            for c in r.findall('m:c',NS):
                col=re.match(r'[A-Z]+',c.get('r')).group(); v=c.find('m:v',NS); t=c.get('t')
                if t=='inlineStr': val=''.join(x.text or '' for x in c.iter('{%s}t'%NS['m']))
                elif v is None: val=None
                elif t=='s': val=ss[int(v.text)]
                else: val=v.text
                row[col]=val
            rows.append(row)
        sheets[n]=rows
    return sheets
if __name__=='__main__':
    for n,rows in read(sys.argv[1]).items():
        print(n,len(rows))
        for r in rows[:6]: print(r)
