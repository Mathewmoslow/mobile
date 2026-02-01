import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DEFAULT_BASE_BRANCH = 'main';
const DEFAULT_COMMIT_COUNT = '100';

const DECISIONS = ['Keep', 'Restore', 'Investigate'];

export default function Index() {
  const [repoPath, setRepoPath] = useState('');
  const [featureBranch, setFeatureBranch] = useState('');
  const [baseBranch, setBaseBranch] = useState(DEFAULT_BASE_BRANCH);
  const [commitCount, setCommitCount] = useState(DEFAULT_COMMIT_COUNT);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState('');
  const [decisions, setDecisions] = useState({});

  const auditApiUrl = process.env.EXPO_PUBLIC_AUDIT_API_URL;
  const isFormValid = useMemo(() => {
    return repoPath.trim().length > 0 && featureBranch.trim().length > 0 && commitCount.trim().length > 0;
  }, [repoPath, featureBranch, commitCount]);

  const parsedReport = useMemo(() => parseReport(report), [report]);

  const setDecision = (group, id, value) => {
    setDecisions((prev) => ({
      ...prev,
      [group]: {
        ...(prev[group] || {}),
        [id]: value,
      },
    }));
  };

  const actionPlan = useMemo(() => {
    if (!parsedReport) return '';
    const plan = {
      repo: parsedReport.repo,
      baseBranch: parsedReport.baseBranch,
      featureBranch: parsedReport.featureBranch,
      createdAt: new Date().toISOString(),
      decisions: {
        missingFromFeature: [],
        onlyOnFeature: [],
        historyPairs: [],
      },
    };
    parsedReport.missingFromFeature.forEach((item) => {
      const decision = decisions.missingFromFeature?.[item.sha] || 'Unassigned';
      plan.decisions.missingFromFeature.push({ ...item, decision });
    });
    parsedReport.onlyOnFeature.forEach((item) => {
      const decision = decisions.onlyOnFeature?.[item.sha] || 'Unassigned';
      plan.decisions.onlyOnFeature.push({ ...item, decision });
    });
    parsedReport.historyPairs.forEach((item) => {
      const decision = decisions.historyPairs?.[item.id] || 'Unassigned';
      plan.decisions.historyPairs.push({ ...item, decision });
    });
    return JSON.stringify(plan, null, 2);
  }, [parsedReport, decisions]);

  const handleSubmit = async () => {
    setError('');
    setReport('');
    if (!auditApiUrl) {
      setError('Missing EXPO_PUBLIC_AUDIT_API_URL. Set it in environment variables.');
      return;
    }
    if (!isFormValid) {
      setError('Please fill out repo path, feature branch, and commit count.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(auditApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: repoPath.trim(),
          featureBranch: featureBranch.trim(),
          baseBranch: baseBranch.trim() || DEFAULT_BASE_BRANCH,
          commitCount: Number.parseInt(commitCount, 10),
          includeHistory,
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Request failed with status ${response.status}`);
      }
      setReport(text);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Commit Audit</Text>
        <Text style={styles.subtitle}>
          Provide the repo details to generate a report of missing or removed changes.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Repo (owner/repo)</Text>
          <TextInput
            value={repoPath}
            onChangeText={setRepoPath}
            placeholder="owner/repo"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Feature branch</Text>
          <TextInput
            value={featureBranch}
            onChangeText={setFeatureBranch}
            placeholder="feature/branch-name"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Base branch</Text>
          <TextInput
            value={baseBranch}
            onChangeText={setBaseBranch}
            placeholder="main"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Commit count</Text>
          <TextInput
            value={commitCount}
            onChangeText={setCommitCount}
            placeholder="100"
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setIncludeHistory((prev) => !prev)}
        >
          <View style={[styles.toggle, includeHistory && styles.toggleActive]}>
            <View style={[styles.toggleKnob, includeHistory && styles.toggleKnobActive]} />
          </View>
          <Text style={styles.toggleLabel}>Include main history audit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, (!isFormValid || isSubmitting) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Run Audit</Text>}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {parsedReport ? (
          <>
            <Section title="Missing from feature">
              {parsedReport.missingFromFeature.length === 0 ? (
                <Text style={styles.emptyText}>None</Text>
              ) : (
                parsedReport.missingFromFeature.map((item) => (
                  <AuditCard
                    key={item.sha}
                    title={`${item.sha} ${item.message}`}
                    subtitle={item.meta}
                    details={item.details}
                    decision={decisions.missingFromFeature?.[item.sha]}
                    onDecision={(value) => setDecision('missingFromFeature', item.sha, value)}
                  />
                ))
              )}
            </Section>

            <Section title="Only on feature">
              {parsedReport.onlyOnFeature.length === 0 ? (
                <Text style={styles.emptyText}>None</Text>
              ) : (
                parsedReport.onlyOnFeature.map((item) => (
                  <AuditCard
                    key={item.sha}
                    title={`${item.sha} ${item.message}`}
                    subtitle={item.meta}
                    details={item.details}
                    decision={decisions.onlyOnFeature?.[item.sha]}
                    onDecision={(value) => setDecision('onlyOnFeature', item.sha, value)}
                  />
                ))
              )}
            </Section>

            <Section title="Main history audit">
              {parsedReport.historyPairs.length === 0 ? (
                <Text style={styles.emptyText}>No pairs found.</Text>
              ) : (
                parsedReport.historyPairs.map((item) => (
                  <AuditCard
                    key={item.id}
                    title={`Pair ${item.headSha} -> ${item.baseSha}`}
                    subtitle={item.compareUrl || 'No compare link'}
                    details={item.details}
                    decision={decisions.historyPairs?.[item.id]}
                    onDecision={(value) => setDecision('historyPairs', item.id, value)}
                    tagList={item.riskTags}
                  />
                ))
              )}
            </Section>

            <Section title="Action plan (JSON)">
              <TextInput
                style={styles.codeBlock}
                value={actionPlan}
                editable={false}
                multiline
              />
            </Section>
          </>
        ) : report ? (
          <View style={styles.reportContainer}>
            <Text style={styles.reportTitle}>Report</Text>
            <Text style={styles.reportText}>{report}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function AuditCard({ title, subtitle, details, decision, onDecision, tagList }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      {tagList && tagList.length > 0 ? (
        <View style={styles.tagRow}>
          {tagList.map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tag}
            </Text>
          ))}
        </View>
      ) : null}
      {details && details.length > 0 ? (
        <View style={styles.detailList}>
          {details.map((line, idx) => (
            <Text key={`${line}-${idx}`} style={styles.detailText}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.decisionRow}>
        {DECISIONS.map((label) => (
          <TouchableOpacity
            key={label}
            style={[styles.decisionButton, decision === label && styles.decisionButtonActive]}
            onPress={() => onDecision(label)}
          >
            <Text style={[styles.decisionText, decision === label && styles.decisionTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function parseReport(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const result = {
    repo: '',
    baseBranch: '',
    featureBranch: '',
    missingFromFeature: [],
    onlyOnFeature: [],
    historyPairs: [],
  };
  let section = '';
  let currentPair = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('Repo:')) {
      result.repo = line.replace('Repo:', '').trim();
    } else if (line.startsWith('Base branch:')) {
      result.baseBranch = line.replace('Base branch:', '').trim();
    } else if (line.startsWith('Feature branch:')) {
      result.featureBranch = line.replace('Feature branch:', '').trim();
    } else if (line.startsWith('Missing from feature')) {
      section = 'missing';
    } else if (line.startsWith('Only on feature')) {
      section = 'featureOnly';
    } else if (line.startsWith('Main Branch History Audit')) {
      section = 'history';
    } else if (line.startsWith('Pair:')) {
      const match = line.match(/Pair:\s+(\w+)\s+->\s+(\w+)/);
      currentPair = match
        ? {
            id: `${match[1]}-${match[2]}`,
            headSha: match[1],
            baseSha: match[2],
            compareUrl: '',
            details: [],
            riskTags: [],
          }
        : null;
      if (currentPair) {
        result.historyPairs.push(currentPair);
      }
    } else if (line.startsWith('Compare:') && currentPair) {
      currentPair.compareUrl = line.replace('Compare:', '').trim();
    } else if (line.startsWith('-') && section === 'missing') {
      const item = parseCommitLine(line);
      if (item) result.missingFromFeature.push(item);
    } else if (line.startsWith('-') && section === 'featureOnly') {
      const item = parseCommitLine(line);
      if (item) result.onlyOnFeature.push(item);
    } else if (section === 'history' && currentPair && line.length > 0) {
      if (line.startsWith('- High-risk removals:')) {
        // no-op header
      } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        currentPair.details.push(line.replace(/^[-*•]\s+/, '').trim());
        const tagMatch = line.match(/\[(.+)\]$/);
        if (tagMatch) {
          currentPair.riskTags.push(...tagMatch[1].split(',').map((t) => t.trim()));
        }
      } else if (line.startsWith('-') || line.includes('Lines removed')) {
        currentPair.details.push(line);
      }
    }
  }
  return result;
}

function parseCommitLine(line) {
  const cleaned = line.replace(/^-/, '').trim();
  const match = cleaned.match(/^([0-9a-f]{6,40})\s+(.*)\s+\((.*)\)$/i);
  if (!match) return null;
  return {
    sha: match[1],
    message: match[2],
    meta: match[3],
    details: [],
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e5e5e5',
    padding: 3,
  },
  toggleActive: {
    backgroundColor: '#111',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#111',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#b00020',
    fontSize: 13,
  },
  reportContainer: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111',
  },
  reportText: {
    fontSize: 12,
    color: '#333',
  },
  section: {
    marginTop: 18,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  emptyText: {
    color: '#777',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#555',
  },
  detailList: {
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#333',
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  decisionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f7f7f7',
  },
  decisionButtonActive: {
    borderColor: '#111',
    backgroundColor: '#111',
  },
  decisionText: {
    fontSize: 12,
    color: '#333',
  },
  decisionTextActive: {
    color: '#fff',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#111',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  codeBlock: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#f7f7f7',
    fontSize: 12,
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
