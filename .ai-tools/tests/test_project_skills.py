import importlib.util, json, pathlib, shutil, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('p9skills',ROOT/'.ai-tools/validate_project_skills.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SkillsTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=pathlib.Path(self.tmp.name)
        for name in ['.agents','.claude'] : shutil.copytree(ROOT/name,self.root/name)
        (self.root/'.ai-tools').mkdir();shutil.copy(ROOT/'.ai-tools/project-skills.json',self.root/'.ai-tools/project-skills.json')
    def test_current_mirrors(self):
        a=m.audit(self.root);self.assertEqual((a['skills'],a['files']),(5,10));self.assertFalse(a['runtime_verified'])
    def test_missing_file(self):
        (self.root/'.claude/skills/p9-reprise/SKILL.md').unlink()
        with self.assertRaises(OSError):m.audit(self.root)
    def test_modified_file(self):
        (self.root/'.agents/skills/p9-reprise/SKILL.md').write_text('broken')
        with self.assertRaises(ValueError):m.audit(self.root)
    def test_duplicate_record(self):
        p=self.root/'.ai-tools/project-skills.json';j=json.loads(p.read_text());j['skills'].append(j['skills'][0]);p.write_text(json.dumps(j))
        with self.assertRaises(ValueError):m.audit(self.root)
    def test_symlink(self):
        p=self.root/'.agents/skills/p9-reprise/SKILL.md';data=p.read_bytes();p.unlink();outside=self.root/'source.md';outside.write_bytes(data);p.symlink_to(outside)
        with self.assertRaises(ValueError):m.audit(self.root)
if __name__=='__main__':unittest.main()
