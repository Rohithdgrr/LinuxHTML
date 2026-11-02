import json
import base64
import io
import zipfile
import stat
import pathlib
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from backend.server import create_server

class BackendTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.token = 'x' * 32
        self.server = create_server('127.0.0.1', 0, str(pathlib.Path(self.tmp.name)/'db.sqlite'), self.token)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True); self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'
    def tearDown(self):
        self.server.shutdown(); self.thread.join(); self.server.server_close(); self.tmp.cleanup()
    def req(self, method, path, data=None, token=True):
        headers = {'Authorization':'Bearer '+self.token} if token else {}
        raw = None if data is None else json.dumps(data).encode()
        req = urllib.request.Request(self.base+path, data=raw, headers=headers, method=method)
        try: r = urllib.request.urlopen(req)
        except urllib.error.HTTPError as e: r = e
        with r: return r.status, json.load(r)
    def test_auth_and_health(self):
        self.assertEqual(self.req('GET','/health',token=False)[0],200)
        self.assertEqual(self.req('GET','/v1/projects',token=False)[0],401)
    def test_status_requires_auth(self):
        self.assertEqual(self.req('GET','/v1/status',token=False)[0],401)
        self.req('POST','/v1/projects',{'name':'monitor'})
        self.req('PUT','/v1/projects/monitor/files/a',{'content':'é','revision':None})
        code, data = self.req('GET','/v1/status')
        self.assertEqual(code,200); self.assertEqual((data['projects'],data['files'],data['content_bytes']),(1,1,2))
        self.assertGreater(data['database_bytes'],0)

    def test_project_and_revision(self):
        self.assertEqual(self.req('POST','/v1/projects',{'name':'demo'})[0],201)
        self.assertEqual(self.req('POST','/v1/projects',{'name':'demo'})[0],409)
        url='/v1/projects/demo/files/src/main.txt'
        status,item=self.req('PUT',url,{'content':'hello','revision':None});self.assertEqual(status,201)
        rev=item['revision']
        self.assertEqual(self.req('PUT',url,{'content':'bad','revision':None})[0],409)
        self.assertEqual(self.req('GET',url)[1]['content'],'hello')
        self.assertEqual(self.req('GET','/v1/projects/demo/files')[1]['files'][0]['path'],'src/main.txt')
        status,item=self.req('PUT',url,{'content':'new','revision':rev});self.assertEqual(status,200)
        self.assertEqual(self.req('DELETE',url,{'revision':rev})[0],409)
        self.assertEqual(self.req('DELETE',url,{'revision':item['revision']})[0],200)
        self.assertEqual(self.req('GET',url)[0],404)
    def test_concurrent_writes_and_restart(self):
        self.req('POST','/v1/projects',{'name':'race'})
        url='/v1/projects/race/files/a.txt'
        rev = self.req('PUT',url,{'content':'start','revision':None})[1]['revision']
        barrier = threading.Barrier(2); outcomes = []
        def write(text):
            barrier.wait(); outcomes.append(self.req('PUT',url,{'content':text,'revision':rev})[0])
        workers = [threading.Thread(target=write,args=(str(i),)) for i in range(2)]
        for w in workers: w.start()
        for w in workers: w.join()
        self.assertEqual(sorted(outcomes),[200,409])
        self.server.shutdown(); self.thread.join(); self.server.server_close()
        self.server = create_server('127.0.0.1',0,str(pathlib.Path(self.tmp.name)/'db.sqlite'),self.token)
        self.thread = threading.Thread(target=self.server.serve_forever,daemon=True); self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'
        self.assertIn(self.req('GET',url)[1]['content'],('0','1'))

    def raw(self, method, path, data=None):
        req = urllib.request.Request(self.base+path,data=data,headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/zip'},method=method)
        try: r=urllib.request.urlopen(req)
        except urllib.error.HTTPError as e: r=e
        with r: return r.status,r.read()
    def zip_bytes(self, entries):
        output=io.BytesIO()
        with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
            for name,data in entries: z.writestr(name,data)
        return output.getvalue()
    def test_binary_and_zip_roundtrip(self):
        self.req('POST','/v1/projects',{'name':'one'}); self.req('POST','/v1/projects',{'name':'two'})
        text='/v1/projects/one/files/docs/test.txt'; binary='/v1/projects/one/files/assets/pic.bin'
        self.req('PUT',text,{'content':'Hello 🌍','revision':None})
        data=b'\x00\xff\x80PNG\x00'; encoded=base64.b64encode(data).decode()
        self.assertEqual(self.req('PUT',binary,{'content_base64':encoded,'revision':None})[0],201)
        self.assertEqual(self.req('GET',binary)[1]['content_base64'],encoded)
        self.assertEqual(self.req('PUT','/v1/projects/one/files/bad',{'content_base64':'@@@@','revision':None})[0],400)
        status,archive=self.raw('GET','/v1/projects/one/archive'); self.assertEqual(status,200)
        with zipfile.ZipFile(io.BytesIO(archive)) as z:
            self.assertEqual(z.read('assets/pic.bin'),data); self.assertEqual(z.read('docs/test.txt').decode(),'Hello 🌍')
        status,body=self.raw('POST','/v1/projects/two/archive',archive); self.assertEqual(status,201)
        self.assertEqual(json.loads(body)['imported'],2)
        self.assertEqual(self.req('GET','/v1/projects/two/files/assets/pic.bin')[1]['content_base64'],encoded)
        self.assertEqual(self.req('GET','/v1/projects/two/files/docs/test.txt')[1]['content'],'Hello 🌍')
        # Conflicts must roll back even entries preceding the collision.
        archive=self.zip_bytes([('new.txt','new'),('docs/test.txt','conflict')])
        self.assertEqual(self.raw('POST','/v1/projects/two/archive',archive)[0],409)
        self.assertEqual(self.req('GET','/v1/projects/two/files/new.txt')[0],404)
    def test_atomic_move(self):
        self.req('POST','/v1/projects',{'name':'moves'})
        base='/v1/projects/moves/'; rev=self.req('PUT',base+'files/a',{'content':'v','revision':None})[1]['revision']
        self.req('PUT',base+'files/existing',{'content':'x','revision':None})
        self.assertEqual(self.req('POST',base+'move',{'source':'a','destination':'existing','revision':rev})[0],409)
        self.assertEqual(self.req('POST',base+'move',{'source':'a','destination':'sub/b','revision':'stale'})[0],409)
        status, result=self.req('POST',base+'move',{'source':'a','destination':'sub/b','revision':rev});self.assertEqual(status,200)
        self.assertNotEqual(result['revision'],rev)
        self.assertEqual(self.req('GET',base+'files/a')[0],404)
        self.assertEqual(self.req('GET',base+'files/sub/b')[1]['content'],'v')

    def test_delete_empty_project_only(self):
        self.req('POST','/v1/projects',{'name':'delete-me'})
        self.assertEqual(self.req('DELETE','/v1/projects/delete-me',{'confirm':'wrong'})[0],400)
        status, file = self.req('PUT','/v1/projects/delete-me/files/a',{'content':'x','revision':None})
        self.assertEqual(self.req('DELETE','/v1/projects/delete-me',{'confirm':'delete-me'})[0],409)
        self.assertEqual(self.req('DELETE','/v1/projects/delete-me/files/a',{'revision':file['revision']})[0],200)
        self.assertEqual(self.req('DELETE','/v1/projects/delete-me',{'confirm':'delete-me'})[0],200)
        self.assertEqual(self.req('GET','/v1/projects/delete-me/files')[0],404)

    def test_archive_rejects_unsafe_entries(self):
        self.req('POST','/v1/projects',{'name':'p'})
        for entries in [[('../escape','x')],[('a/../../escape','x')],[('dup','1'),('dup','2')],[('big','x'*(700*1024+1))]]:
            self.assertEqual(self.raw('POST','/v1/projects/p/archive',self.zip_bytes(entries))[0],400)
        output=io.BytesIO()
        with zipfile.ZipFile(output,'w') as z:
            link=zipfile.ZipInfo('link'); link.create_system=3; link.external_attr=(stat.S_IFLNK | 0o777)<<16; z.writestr(link,'target')
        self.assertEqual(self.raw('POST','/v1/projects/p/archive',output.getvalue())[0],400)
        self.assertEqual(self.raw('POST','/v1/projects/p/archive',b'garbage')[0],400)
        self.assertEqual(self.req('GET','/v1/projects/p/files')[1]['files'],[])

    def test_invalid_paths_and_limits(self):
        self.req('POST','/v1/projects',{'name':'p'})
        for path in ('../x','a/%2e%2e/x','a%5cb','a//x'):
            self.assertEqual(self.req('PUT','/v1/projects/p/files/'+path,{'content':'a','revision':None})[0],404)
        self.assertEqual(self.req('PUT','/v1/projects/p/files/big',{'content':'x'*(700*1024+1),'revision':None})[0],400)

if __name__ == '__main__': unittest.main()
