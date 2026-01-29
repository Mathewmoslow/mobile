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

export default function Index() {
  const [repoPath, setRepoPath] = useState('');
  const [featureBranch, setFeatureBranch] = useState('');
  const [baseBranch, setBaseBranch] = useState(DEFAULT_BASE_BRANCH);
  const [commitCount, setCommitCount] = useState(DEFAULT_COMMIT_COUNT);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState('');

  const auditApiUrl = process.env.EXPO_PUBLIC_AUDIT_API_URL;
  const isFormValid = useMemo(() => {
    return repoPath.trim().length > 0 && featureBranch.trim().length > 0 && commitCount.trim().length > 0;
  }, [repoPath, featureBranch, commitCount]);

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
        {report ? (
          <View style={styles.reportContainer}>
            <Text style={styles.reportTitle}>Report</Text>
            <Text style={styles.reportText}>{report}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
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
});
